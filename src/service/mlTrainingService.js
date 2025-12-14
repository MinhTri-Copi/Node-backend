/**
 * ML TRAINING SERVICE
 * 
 * Service để tự động train ML model từ Node.js
 * Gọi Python script train_grader.py sau khi có training data mới
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const trainingDataService = require('./trainingDataService');

const HUMAN_CSV_NAME = 'grading_data_human.csv';
const LLM_CSV_NAME = 'grading_data.csv';

/**
 * Export dữ liệu đã HR duyệt ra CSV (dùng cho human model)
 * @param {string} mlGraderPath
 * @returns {Promise<string|null>} đường dẫn CSV hoặc null nếu không có dữ liệu
 */
const exportHumanTrainingCSV = async (mlGraderPath) => {
    try {
        const data = await trainingDataService.exportAnswersForCSV();

        if (!data || data.length === 0) {
            console.warn('⚠️ Không có dữ liệu human đã duyệt để xuất CSV.');
            return null;
        }

        const targetPath = path.resolve(mlGraderPath, HUMAN_CSV_NAME);
        const headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore'];
        const lines = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(h => {
                const v = row[h] ?? '';
                const str = String(v).replace(/"/g, '""');
                if (str.includes(',') || str.includes('\n') || str.includes('\r')) {
                    return `"${str}"`;
                }
                return str;
            });
            lines.push(values.join(','));
        }

        fs.writeFileSync(targetPath, lines.join('\n'), 'utf8');
        console.log(`✅ Đã xuất CSV human: ${targetPath} (${data.length} dòng)`);
        return targetPath;
    } catch (err) {
        console.warn('⚠️ Không thể export human training CSV:', err.message);
        return null;
    }
};

/**
 * Train ML model bằng cách gọi Python script
 * @param {string} csvPath - Đường dẫn đến grading_data.csv (LLM-generated)
 * @param {Object} options - { pythonPath, mlGraderPath, timeout }
 * @returns {Promise<Object>} { success, message, output, error }
 */
const trainMLModel = async (csvPath = null, options = {}) => {
    const {
        pythonPath = null, // Sẽ tự động detect
        mlGraderPath = path.resolve(__dirname, '../../../ml-grader'), // Lên 3 cấp từ backend/src/service/ để ra root
        timeout = 300000 // 5 phút timeout
    } = options;

    return new Promise(async (resolve) => {
        // Xác định đường dẫn CSV
        const finalCsvPath = csvPath || path.resolve(mlGraderPath, LLM_CSV_NAME);
        
        // Kiểm tra file CSV tồn tại
        if (!fs.existsSync(finalCsvPath)) {
            resolve({
                success: false,
                message: `File CSV không tồn tại: ${finalCsvPath}`,
                output: '',
                error: 'CSV file not found'
            });
            return;
        }

        // Đường dẫn script Python
        const scriptPath = path.resolve(mlGraderPath, 'train_grader.py');
        
        if (!fs.existsSync(scriptPath)) {
            resolve({
                success: false,
                message: `Script Python không tồn tại: ${scriptPath}`,
                output: '',
                error: 'Python script not found'
            });
            return;
        }

        // Export human CSV (không bắt buộc, chỉ để ưu tiên model human nếu có)
        let humanCsvPath = null;
        try {
            humanCsvPath = await exportHumanTrainingCSV(mlGraderPath);
        } catch (e) {
            humanCsvPath = null;
        }

        // Tự động detect Python từ venv hoặc dùng từ env/custom
        let finalPythonPath = pythonPath || process.env.PYTHON_PATH;
        
        if (!finalPythonPath) {
            // Kiểm tra venv trong ml-grader
            const venvPythonPath = process.platform === 'win32' 
                ? path.resolve(mlGraderPath, 'venv/Scripts/python.exe')
                : path.resolve(mlGraderPath, 'venv/bin/python');
            
            if (fs.existsSync(venvPythonPath)) {
                finalPythonPath = venvPythonPath;
                console.log(`✅ Tìm thấy Python venv: ${finalPythonPath}`);
            } else {
                // Fallback về python global
                finalPythonPath = 'python';
                console.warn(`⚠️ Không tìm thấy venv, dùng Python global: ${finalPythonPath}`);
            }
        }

        console.log(`🔄 Đang train ML model...`);
        console.log(`   Python: ${finalPythonPath}`);
        console.log(`   Script: ${scriptPath}`);
        console.log(`   LLM CSV: ${finalCsvPath}`);
        if (humanCsvPath) {
            console.log(`   Human CSV: ${humanCsvPath}`);
        } else {
            console.log('   Human CSV: (không có dữ liệu human hoặc export thất bại)');
        }

        // Chạy Python script với encoding UTF-8 để hỗ trợ emoji/Unicode
        const env = { ...process.env };
        env.PYTHONIOENCODING = 'utf-8'; // Set encoding UTF-8 cho Python output
        
        // Build args: --llm-csv <path> [--human-csv <path>]
        const args = [scriptPath, '--llm-csv', finalCsvPath];
        if (humanCsvPath) {
            args.push('--human-csv', humanCsvPath);
        }

        const pythonProcess = spawn(finalPythonPath, args, {
            cwd: mlGraderPath, // Chạy trong thư mục ml-grader
            stdio: ['ignore', 'pipe', 'pipe'], // Bỏ stdin, capture stdout và stderr
            env: env // Truyền environment với encoding UTF-8
        });

        let stdout = '';
        let stderr = '';
        let isResolved = false;

        // Capture stdout
        pythonProcess.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            // Log real-time để theo dõi
            process.stdout.write(text);
        });

        // Capture stderr
        pythonProcess.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            // Log real-time
            process.stderr.write(text);
        });

        // Timeout handler
        const timeoutId = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                pythonProcess.kill('SIGTERM');
                resolve({
                    success: false,
                    message: `Train ML model timeout sau ${timeout / 1000}s`,
                    output: stdout,
                    error: stderr || 'Timeout'
                });
            }
        }, timeout);

        // Process exit handler
        pythonProcess.on('close', (code) => {
            clearTimeout(timeoutId);
            
            if (isResolved) return;
            isResolved = true;

            if (code === 0) {
                console.log('✅ Train ML model thành công!');
                resolve({
                    success: true,
                    message: 'Train ML model thành công',
                    output: stdout,
                    error: stderr
                });
            } else {
                console.error(`❌ Train ML model thất bại với exit code: ${code}`);
                resolve({
                    success: false,
                    message: `Train ML model thất bại (exit code: ${code})`,
                    output: stdout,
                    error: stderr
                });
            }
        });

        // Error handler
        pythonProcess.on('error', (error) => {
            clearTimeout(timeoutId);
            
            if (isResolved) return;
            isResolved = true;

            console.error('❌ Lỗi khi chạy Python script:', error.message);
            resolve({
                success: false,
                message: `Lỗi khi chạy Python: ${error.message}`,
                output: stdout,
                error: error.message
            });
        });
    });
};

/**
 * Train ML model trong background (không block)
 * @param {string} csvPath - Đường dẫn đến grading_data.csv
 * @param {Object} options - Options cho trainMLModel
 * @returns {Promise<Object>} Promise resolve ngay, training chạy background
 */
const trainMLModelBackground = async (csvPath = null, options = {}) => {
    // Chạy training trong background, không đợi kết quả
    trainMLModel(csvPath, options)
        .then(result => {
            if (result.success) {
                console.log('✅ [Background] Train ML model thành công');
            } else {
                console.warn(`⚠️ [Background] Train ML model thất bại: ${result.message}`);
            }
        })
        .catch(error => {
            console.error('❌ [Background] Lỗi train ML model:', error.message);
        });

    // Trả về ngay lập tức
    return {
        success: true,
        message: 'Đã bắt đầu train ML model trong background',
        trainingInProgress: true
    };
};

/**
 * Kiểm tra xem ML model đã được train chưa
 * @param {string} mlGraderPath - Đường dẫn đến thư mục ml-grader
 * @returns {Object} { isTrained, modelPath, embedderPath }
 */
const checkMLModelStatus = (mlGraderPath = null) => {
    const finalPath = mlGraderPath || path.resolve(__dirname, '../../../ml-grader');
    
    const modelPath = path.resolve(finalPath, 'grading_reg.joblib');
    const embedderPath = path.resolve(finalPath, 'embedder');
    
    const modelExists = fs.existsSync(modelPath);
    const embedderExists = fs.existsSync(embedderPath) && fs.statSync(embedderPath).isDirectory();
    
    const result = {
        isTrained: modelExists && embedderExists,
        modelPath: modelExists ? modelPath : null,
        embedderPath: embedderExists ? embedderPath : null,
        modelExists,
        embedderExists
    };
    
    return result;
};

module.exports = {
    trainMLModel,
    trainMLModelBackground,
    checkMLModelStatus
};

