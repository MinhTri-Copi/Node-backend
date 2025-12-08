/**
 * PHA B - Bước B2: Script import CSV đã có teacherScore về database
 * 
 * CSV format: questionId, questionText, correctAnswer, studentAnswer, maxScore, teacherScore
 * 
 * Cách dùng:
 * node scripts/import-csv-with-scores.js input.csv
 * 
 * Script này sẽ:
 * 1. Đọc CSV
 * 2. Tìm TestAnswer tương ứng
 * 3. Cập nhật teacherScore (lưu vào một bảng riêng hoặc metadata)
 * 
 * Lưu ý: Hiện tại chỉ đọc và validate, chưa cập nhật DB (cần tạo bảng TrainingData)
 */

const fs = require('fs');
const path = require('path');

// Hàm parse CSV đơn giản (không cần thư viện)
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('CSV file phải có ít nhất 1 dòng header và 1 dòng data');
    }
    
    // Parse header
    const headers = parseCSVLine(lines[0]);
    
    // Parse data
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        results.push({
            questionId: parseInt(row.questionId) || 0,
            questionText: row.questionText || '',
            correctAnswer: row.correctAnswer || '',
            studentAnswer: row.studentAnswer || '',
            maxScore: parseFloat(row.maxScore) || 10,
            teacherScore: parseFloat(row.teacherScore) || 0
        });
    }
    
    return results;
}

// Hàm parse một dòng CSV (xử lý dấu phẩy trong dấu ngoặc kép)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
}

// Main
const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('📖 Cách dùng:');
    console.log('   node scripts/import-csv-with-scores.js <input.csv>');
    console.log('');
    console.log('📝 CSV format:');
    console.log('   questionId,questionText,correctAnswer,studentAnswer,maxScore,teacherScore');
    process.exit(1);
}

const inputFile = args[0];

if (!fs.existsSync(inputFile)) {
    console.error(`❌ File không tồn tại: ${inputFile}`);
    process.exit(1);
}

console.log('🔄 Đang đọc CSV...');
try {
    const data = parseCSV(inputFile);
    console.log(`✅ Đã đọc ${data.length} dòng từ CSV`);
    
    // Validate
    const validRows = data.filter(row => {
        return row.questionId > 0 && 
               row.teacherScore >= 0 && 
               row.teacherScore <= row.maxScore;
    });
    
    console.log(`✅ ${validRows.length}/${data.length} dòng hợp lệ`);
    
    if (validRows.length === 0) {
        console.error('❌ Không có dòng dữ liệu hợp lệ!');
        process.exit(1);
    }
    
    // Thống kê
    const stats = {
        total: validRows.length,
        avgScore: validRows.reduce((sum, r) => sum + r.teacherScore, 0) / validRows.length,
        minScore: Math.min(...validRows.map(r => r.teacherScore)),
        maxScore: Math.max(...validRows.map(r => r.teacherScore)),
        questions: new Set(validRows.map(r => r.questionId)).size
    };
    
    console.log('\n📊 Thống kê:');
    console.log(`   - Tổng số dòng: ${stats.total}`);
    console.log(`   - Số câu hỏi khác nhau: ${stats.questions}`);
    console.log(`   - Điểm trung bình: ${stats.avgScore.toFixed(2)}`);
    console.log(`   - Điểm thấp nhất: ${stats.minScore}`);
    console.log(`   - Điểm cao nhất: ${stats.maxScore}`);
    
    // Lưu JSON để dùng sau
    const outputJson = path.join(path.dirname(inputFile), 'training-data-with-scores.json');
    fs.writeFileSync(outputJson, JSON.stringify(validRows, null, 2), 'utf8');
    console.log(`\n✅ Đã lưu JSON: ${outputJson}`);
    console.log('\n💡 Bước tiếp theo:');
    console.log('   - Copy file này vào ml-grader/grading_data.csv');
    console.log('   - Hoặc dùng trực tiếp file JSON này để train ML model');
} catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
}

