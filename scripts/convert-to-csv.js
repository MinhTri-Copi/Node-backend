/**
 * PHA B - Bước B1: Script chuyển đổi JSON sang CSV
 * 
 * Cách dùng:
 * 1. Gọi API: GET http://localhost:3000/api/debug/export-answers
 * 2. Lưu response JSON vào file: training-data.json
 * 3. Chạy script: node scripts/convert-to-csv.js training-data.json output.csv
 */

const fs = require('fs');
const path = require('path');

// Hàm escape CSV (xử lý dấu phẩy, dấu ngoặc kép, xuống dòng)
function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    const str = String(value);
    
    // Nếu có dấu phẩy, dấu ngoặc kép, hoặc xuống dòng → bọc trong dấu ngoặc kép
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        // Escape dấu ngoặc kép bằng cách nhân đôi
        return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
}

// Hàm chuyển đổi JSON sang CSV
function jsonToCSV(jsonData, outputPath) {
    if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
        console.error('❌ Dữ liệu JSON không hợp lệ hoặc rỗng');
        return;
    }

    // Header CSV
    const headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore'];
    const headerLine = headers.map(h => escapeCSV(h)).join(',');

    // Tạo các dòng dữ liệu
    const dataLines = jsonData.map(row => {
        return headers.map(header => {
            const value = row[header] || row[header.toLowerCase()] || '';
            return escapeCSV(value);
        }).join(',');
    });

    // Gộp header và data
    const csvContent = [headerLine, ...dataLines].join('\n');

    // Ghi file
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    
    console.log(`✅ Đã chuyển đổi ${jsonData.length} dòng sang CSV`);
    console.log(`📁 File output: ${path.resolve(outputPath)}`);
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('📖 Cách dùng:');
    console.log('   node scripts/convert-to-csv.js <input.json> <output.csv>');
    console.log('');
    console.log('📝 Ví dụ:');
    console.log('   1. Gọi API: GET http://localhost:3000/api/debug/export-answers');
    console.log('   2. Lưu response vào file: training-data.json');
    console.log('   3. Chạy: node scripts/convert-to-csv.js training-data.json output.csv');
    process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

// Kiểm tra file input
if (!fs.existsSync(inputFile)) {
    console.error(`❌ File không tồn tại: ${inputFile}`);
    process.exit(1);
}

// Đọc JSON
let jsonData;
try {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const parsed = JSON.parse(fileContent);
    
    // Nếu response có format { success: true, data: [...] }
    if (parsed.success && parsed.data) {
        jsonData = parsed.data;
    } else if (Array.isArray(parsed)) {
        jsonData = parsed;
    } else {
        console.error('❌ Format JSON không hợp lệ. Cần array hoặc { success: true, data: [...] }');
        process.exit(1);
    }
} catch (error) {
    console.error(`❌ Lỗi đọc file JSON: ${error.message}`);
    process.exit(1);
}

// Chuyển đổi sang CSV
jsonToCSV(jsonData, outputFile);

console.log('✅ Hoàn thành!');

