/**
 * Script để extract text từ CV PDF files và thêm vào cv_examples.json
 * 
 * Usage: node scripts/extract-cv-examples.js
 */

const fs = require('fs');
const path = require('path');

// Lazy load pdf-parse
let pdfParse = null;

async function loadPdfParse() {
    if (!pdfParse) {
        try {
            const pdfModule = require('pdf-parse');
            // pdf-parse v1: function parse(buffer)
            if (typeof pdfModule === 'function') {
                pdfParse = pdfModule;
            } else if (pdfModule.default && typeof pdfModule.default === 'function') {
                pdfParse = pdfModule.default;
            } else if (pdfModule.PDFParse) {
                // pdf-parse v2: PDFParse class
                const PDFParseClass = pdfModule.PDFParse;
                pdfParse = async (buffer) => {
                    const parser = new PDFParseClass({ data: buffer });
                    try {
                        const result = await parser.getText();
                        await parser.destroy();
                        return result.text || '';
                    } catch (error) {
                        try {
                            await parser.destroy();
                        } catch (destroyError) {
                            // Ignore
                        }
                        throw error;
                    }
                };
            } else {
                throw new Error('pdf-parse không tương thích');
            }
        } catch (error) {
            console.error('❌ Error loading pdf-parse:', error);
            throw new Error('Cần cài đặt: npm install pdf-parse');
        }
    }
    return pdfParse;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(filePath) {
    try {
        const pdfParseFunc = await loadPdfParse();
        const fileBuffer = fs.readFileSync(filePath);
        const result = await pdfParseFunc(fileBuffer);
        
        // pdf-parse có thể trả về object {text: "...", ...} hoặc string
        let text = '';
        if (typeof result === 'string') {
            text = result;
        } else if (result && typeof result.text === 'string') {
            text = result.text;
        } else if (result && result.data && typeof result.data.text === 'string') {
            text = result.data.text;
        } else {
            console.warn(`⚠️  Unexpected result type from pdf-parse: ${typeof result}`);
            return null;
        }
        
        return text.trim();
    } catch (error) {
        console.error(`❌ Error extracting text from ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Parse CV filename to get info
 * Format: CV_XX_NAME_ROLE.pdf
 */
function parseCVFilename(filename) {
    const match = filename.match(/CV_(\d+)_(.+?)_(.+)\.pdf/i);
    if (match) {
        return {
            id: parseInt(match[1]),
            name: match[2].replace(/_/g, ' '),
            role: match[3]
        };
    }
    return {
        id: 0,
        name: filename.replace('.pdf', ''),
        role: 'Unknown'
    };
}

/**
 * Main function
 */
async function main() {
    const cvFolderPath = path.resolve(__dirname, '..', 'src', 'Standard_CV');
    const examplesOutputPath = path.resolve(__dirname, '..', 'src', 'data', 'cv_examples.json');

    console.log('📋 Starting CV examples extraction...');
    console.log(`   CV Folder: ${cvFolderPath}`);
    console.log(`   Output: ${examplesOutputPath}`);

    // Check if folder exists
    if (!fs.existsSync(cvFolderPath)) {
        console.error(`❌ Folder không tồn tại: ${cvFolderPath}`);
        process.exit(1);
    }

    // Get all PDF files
    const files = fs.readdirSync(cvFolderPath)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => {
            // Sort by number in filename
            const numA = parseInt(a.match(/CV_(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/CV_(\d+)/)?.[1] || '0');
            return numA - numB;
        });

    console.log(`\n📁 Tìm thấy ${files.length} CV files`);

    if (files.length === 0) {
        console.error('❌ Không tìm thấy file PDF nào!');
        process.exit(1);
    }

    // Load existing examples (if any)
    let existingExamples = [];
    if (fs.existsSync(examplesOutputPath)) {
        try {
            const existingContent = fs.readFileSync(examplesOutputPath, 'utf-8');
            const existing = JSON.parse(existingContent);
            existingExamples = existing.examples || [];
            console.log(`\n📝 Đã có ${existingExamples.length} examples trong file`);
        } catch (error) {
            console.warn('⚠️  Không thể đọc file examples hiện có, sẽ tạo mới');
        }
    }

    // Extract text from each PDF
    const newExamples = [];
    const maxExamples = 10; // Chỉ lấy 10 CV đầu tiên để không làm prompt quá dài

    console.log(`\n🔄 Đang extract text từ ${Math.min(files.length, maxExamples)} CV files...\n`);

    for (let i = 0; i < Math.min(files.length, maxExamples); i++) {
        const file = files[i];
        const filePath = path.join(cvFolderPath, file);
        const fileInfo = parseCVFilename(file);

        console.log(`[${i + 1}/${Math.min(files.length, maxExamples)}] Processing: ${file}`);
        console.log(`   Name: ${fileInfo.name}, Role: ${fileInfo.role}`);

        const cvText = await extractTextFromPDF(filePath);

        if (!cvText || cvText.length < 100) {
            console.warn(`   ⚠️  CV text quá ngắn hoặc không extract được, bỏ qua`);
            continue;
        }

        // Determine expected score based on role and content quality
        // Có thể điều chỉnh logic này sau
        let expectedScore = 80; // Default
        if (cvText.length > 2000) expectedScore = 85;
        if (cvText.includes('GPA') || cvText.includes('Technologies:')) expectedScore = 85;

        const example = {
            id: fileInfo.id || (existingExamples.length + newExamples.length + 1),
            name: `CV ${fileInfo.id} - ${fileInfo.name} (${fileInfo.role})`,
            cv_text: cvText,
            expected_score: expectedScore,
            notes: `CV mẫu chuẩn - ${fileInfo.role} Developer. Extracted from ${file}`
        };

        newExamples.push(example);
        console.log(`   ✅ Extracted ${cvText.length} characters\n`);
    }

    // Merge with existing examples
    const allExamples = [...existingExamples, ...newExamples];

    // Remove duplicates by id
    const uniqueExamples = Array.from(
        new Map(allExamples.map(ex => [ex.id, ex])).values()
    ).sort((a, b) => a.id - b.id);

    // Create output object
    const output = {
        description: "CV mẫu chuẩn để dùng làm few-shot examples trong prompt. Được extract từ folder Standard_CV.",
        examples: uniqueExamples,
        last_updated: new Date().toISOString(),
        total_examples: uniqueExamples.length
    };

    // Write to file
    fs.writeFileSync(examplesOutputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log('\n✅ Hoàn thành!');
    console.log(`   Đã thêm ${newExamples.length} CV examples mới`);
    console.log(`   Tổng cộng: ${uniqueExamples.length} examples`);
    console.log(`   File output: ${examplesOutputPath}`);
    console.log('\n💡 Lưu ý:');
    console.log('   - Chỉ extract 10 CV đầu tiên để tránh prompt quá dài');
    console.log('   - Có thể chỉnh sửa expected_score trong file JSON nếu cần');
    console.log('   - Restart backend sau khi cập nhật file');
}

// Run
main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

