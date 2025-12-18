/**
 * CV Text Extraction Service
 * Extract text từ CV file (PDF/DOCX) và lưu vào database
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../models/index.js';

// Polyfill cho DOMMatrix (fix lỗi pdf-parse trong Node.js)
if (typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix {
        constructor(init) {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.e = 0;
            this.f = 0;
            if (init) {
                if (typeof init === 'string') {
                    // Parse matrix string
                    const values = init.match(/[\d.-]+/g);
                    if (values && values.length >= 6) {
                        this.a = parseFloat(values[0]);
                        this.b = parseFloat(values[1]);
                        this.c = parseFloat(values[2]);
                        this.d = parseFloat(values[3]);
                        this.e = parseFloat(values[4]);
                        this.f = parseFloat(values[5]);
                    }
                }
            }
        }
    };
}

// Dependencies sẽ được install sau
let pdfParse = null;
let mammoth = null;

// Lazy load dependencies - dùng dynamic import (Babel sẽ handle CommonJS)
const loadDependencies = async () => {
    try {
        if (!pdfParse) {
            // pdf-parse v2+ dùng PDFParse class, không còn function parse() như v1
            try {
                const pdfModule = await import('pdf-parse');
                
                // pdf-parse v2 export PDFParse class trong default object
                // Từ log: pdfModule.default.PDFParse là class
                const PDFParseClass = pdfModule.PDFParse || 
                                     (pdfModule.default && pdfModule.default.PDFParse);
                
                if (!PDFParseClass) {
                    // Fallback: thử tìm function parse() (v1 API - nếu đã downgrade)
                    const parseFunction = pdfModule.default || pdfModule.parse || pdfModule;
                    
                    if (typeof parseFunction === 'function') {
                        // pdf-parse v1: function parse(buffer)
                        pdfParse = parseFunction;
                        console.log('✅ Đã load pdf-parse v1 (function API)');
                    } else {
                        console.error('❌ Không tìm thấy PDFParse class hoặc parse function');
                        console.error('   Module keys:', Object.keys(pdfModule));
                        if (pdfModule.default) {
                            console.error('   Default keys:', Object.keys(pdfModule.default));
                        }
                        throw new Error('pdf-parse không tương thích. Vui lòng kiểm tra version và Node version.');
                    }
                } else {
                    // pdf-parse v2: PDFParse class
                    // Wrap PDFParse class thành function để dùng như v1
                    pdfParse = async (buffer) => {
                        const parser = new PDFParseClass({ data: buffer });
                        try {
                            const result = await parser.getText();
                            await parser.destroy();
                            return result.text || '';
                        } catch (error) {
                            // Đảm bảo destroy ngay cả khi có lỗi
                            try {
                                await parser.destroy();
                            } catch (destroyError) {
                                // Ignore destroy error
                            }
                            throw error;
                        }
                    };
                    console.log('✅ Đã load pdf-parse v2 (PDFParse class API)');
                }
            } catch (importError) {
                console.error('Error importing pdf-parse:', importError);
                // Nếu lỗi do Node version, gợi ý downgrade
                if (importError.message && (
                    importError.message.includes('getBuiltinModule') ||
                    importError.message.includes('process.getBuiltinModule')
                )) {
                    console.error('⚠️ Lỗi: pdf-parse v2+ cần Node 20.16+ hoặc 22.3+');
                    console.error('   Node hiện tại: ' + process.version);
                    console.error('   Giải pháp:');
                    console.error('   1. Downgrade pdf-parse: npm install pdf-parse@1.1.1');
                    console.error('   2. Hoặc upgrade Node lên 20.16+ hoặc 22.3+');
                }
                throw importError;
            }
        }
        if (!mammoth) {
            // mammoth cũng là CommonJS
            const mammothModule = await import('mammoth');
            
            // mammoth export default là object với methods
            mammoth = mammothModule.default || mammothModule;
            
            // Verify có extractRawText method
            if (!mammoth || typeof mammoth.extractRawText !== 'function') {
                console.error('mammoth module structure:', Object.keys(mammothModule));
                console.error('mammoth default type:', typeof mammothModule.default);
                throw new Error('mammoth không có extractRawText method sau khi import');
            }
        }
    } catch (error) {
        console.warn('⚠️ CV extraction dependencies chưa được install:', error.message);
        console.warn('   Chạy: npm install pdf-parse mammoth');
        throw error; // Re-throw để caller biết
    }
};

/**
 * Tính file hash (MD5) để detect duplicate
 */
const calculateFileHash = (fileBuffer) => {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
};

/**
 * Extract text từ PDF (text-based)
 */
const extractPdfText = async (filePath) => {
    await loadDependencies();
    
    if (!pdfParse) {
        throw new Error('pdf-parse chưa được install. Chạy: npm install pdf-parse');
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        // Clean text: remove multiple spaces/newlines
        const text = (data.text || '').replace(/\s+\n/g, '\n').trim();
        return text;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw new Error(`Không thể extract text từ PDF: ${error.message}`);
    }
};

/**
 * Extract text từ DOCX
 */
const extractDocxText = async (filePath) => {
    await loadDependencies();
    
    if (!mammoth) {
        throw new Error('mammoth chưa được install. Chạy: npm install mammoth');
    }

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return (result.value || '').trim();
    } catch (error) {
        console.error('Error extracting DOCX text:', error);
        throw new Error(`Không thể extract text từ DOCX: ${error.message}`);
    }
};

/**
 * Detect nếu PDF là scan (image-based)
 * Nếu text quá ngắn (< 50 chars) → có thể là scan
 * Note: Giảm threshold để tránh reject CV ngắn hợp lệ
 */
const detectScannedPdf = async (filePath) => {
    try {
        const text = await extractPdfText(filePath);
        const textLength = text.replace(/\s/g, '').length;
        // Giảm threshold từ 200 xuống 50 để tránh reject CV ngắn
        // Nếu text < 50 chars → có thể là scan hoặc file lỗi
        return textLength < 50;
    } catch (error) {
        // Nếu không extract được → có thể là scan hoặc file lỗi
        // Nhưng vẫn thử extract để xem có text không
        return false; // Không reject ngay, để extractCVText xử lý
    }
};

/**
 * Extract text từ file CV
 * Tự động detect loại file và extract
 */
const extractCVText = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.pdf') {
        try {
            // Thử extract text trước
            const text = await extractPdfText(filePath);
            
            // Check nếu text quá ngắn (có thể là scan)
            const textLength = text.replace(/\s/g, '').length;
            if (textLength < 50) {
                // Có thể là scan, nhưng vẫn return text để user biết
                console.warn(`⚠️ PDF có thể là scan (chỉ có ${textLength} ký tự). Vui lòng upload PDF text-based để có kết quả tốt hơn.`);
                // Vẫn return text ngắn này thay vì throw error
                return text;
            }
            
            return text;
        } catch (error) {
            // Nếu extract fail → có thể là scan hoặc file lỗi
            throw new Error(`Không thể extract text từ PDF. File có thể là scan/ảnh hoặc bị lỗi. Vui lòng upload PDF text-based hoặc DOCX. Lỗi: ${error.message}`);
        }
    } else if (ext === '.docx' || ext === '.doc') {
        return await extractDocxText(filePath);
    } else {
        throw new Error(`Định dạng file không được hỗ trợ: ${ext}. Chỉ hỗ trợ PDF và DOCX.`);
    }
};

/**
 * Tạo hoặc cập nhật Record với CV info
 */
const createOrUpdateCandidateCV = async (userId, filePath, fileBuffer) => {
    try {
        const fileHash = calculateFileHash(fileBuffer);
        
        // Check nếu đã có Record với cùng fileHash
        let record = await db.Record.findOne({
            where: { 
                userId,
                fileHash 
            },
            order: [['createdAt', 'DESC']] // Lấy record mới nhất
        });

        if (record) {
            // Nếu đã có và đã extract xong → return luôn
            if (record.extractionStatus === 'READY' && record.cvText) {
                return {
                    EM: 'CV đã được xử lý trước đó',
                    EC: 0,
                    DT: record
                };
            }
            
            // Nếu đang processing hoặc failed → update lại
            record.File_url = filePath;
            record.extractionStatus = 'PENDING';
            record.errorMessage = null;
            await record.save();
        } else {
            // Tạo mới Record
            record = await db.Record.create({
                userId,
                Tieude: 'CV', // Default title
                File_url: filePath,
                fileHash,
                extractionStatus: 'PENDING',
                Ngaytao: new Date()
            });
        }

        return {
            EM: 'CV đã được lưu, đang chờ xử lý',
            EC: 0,
            DT: record
        };
    } catch (error) {
        console.error('Error creating Record with CV:', error);
        return {
            EM: `Lỗi khi lưu CV: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Process CV extraction (async - được gọi bởi background job)
 */
const processCVExtraction = async (recordId) => {
    let record = null;
    try {
        record = await db.Record.findByPk(recordId);
        
        if (!record) {
            throw new Error('Không tìm thấy Record');
        }

        // Update status = PROCESSING
        record.extractionStatus = 'PROCESSING';
        record.errorMessage = null;
        await record.save();

        // Extract text từ File_url (relative path) hoặc absolute path
        const filePath = record.File_url.startsWith('/') 
            ? path.resolve(__dirname, '..', 'public', record.File_url)
            : record.File_url;
        
        const cvText = await extractCVText(filePath);
        
        if (!cvText || cvText.trim().length === 0) {
            throw new Error('Không thể extract text từ CV (file có thể là scan/ảnh)');
        }

        // Update Record với text đã extract
        record.cvText = cvText;
        record.extractionStatus = 'READY';
        record.extractedAt = new Date();
        await record.save();

        console.log(`✅ Đã extract CV text cho user ${record.userId}, length: ${cvText.length}`);

        return {
            EM: 'Extract CV text thành công',
            EC: 0,
            DT: record
        };
    } catch (error) {
        console.error('Error processing CV extraction:', error);
        
        // Update status = FAILED
        if (record) {
            record.extractionStatus = 'FAILED';
            record.errorMessage = error.message;
            await record.save();
        }

        return {
            EM: `Lỗi khi extract CV: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get CV extraction status của user
 */
const getCVExtractionStatus = async (userId) => {
    try {
        const record = await db.Record.findOne({
            where: { userId },
            order: [['createdAt', 'DESC']] // Lấy CV mới nhất
        });

        if (!record || !record.File_url) {
            return {
                EM: 'Chưa có CV được upload',
                EC: 1,
                DT: {
                    status: 'NO_CV',
                    hasCV: false
                }
            };
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                status: record.extractionStatus || 'PENDING',
                hasCV: true,
                extractedAt: record.extractedAt,
                errorMessage: record.errorMessage,
                fileHash: record.fileHash
            }
        };
    } catch (error) {
        console.error('Error getting CV extraction status:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get CV text của user (nếu đã extract)
 */
const getCVTextByUserId = async (userId) => {
    try {
        const record = await db.Record.findOne({
            where: {
                userId,
                extractionStatus: 'READY'
            },
            order: [['extractedAt', 'DESC']] // Lấy CV mới nhất
        });

        if (!record || !record.cvText) {
            return {
                EM: 'Chưa có CV text cho user này',
                EC: 1,
                DT: null
            };
        }

        return {
            EM: 'OK',
            EC: 0,
            DT: {
                cvText: record.cvText,
                extractedAt: record.extractedAt,
                fileHash: record.fileHash
            }
        };
    } catch (error) {
        console.error('Error getting CV text:', error);
        return {
            EM: `Lỗi: ${error.message}`,
            EC: -1,
            DT: null
        };
    }
};

export {
    extractCVText,
    extractPdfText,
    extractDocxText,
    detectScannedPdf,
    createOrUpdateCandidateCV,
    processCVExtraction,
    getCVTextByUserId,
    getCVExtractionStatus,
    calculateFileHash
};

