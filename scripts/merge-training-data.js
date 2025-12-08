/**
 * Script merge dữ liệu training mới vào file cũ
 * 
 * Cách dùng:
 * node scripts/merge-training-data.js [new-data.csv] [output.csv]
 * 
 * Nếu không có output.csv, sẽ merge vào ml-grader/grading_data.csv
 */

const fs = require('fs');
const path = require('path');

// Hàm parse CSV đơn giản
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('CSV file phải có ít nhất 1 dòng header và 1 dòng data');
    }
    
    const headers = parseCSVLine(lines[0]);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        results.push(row);
    }
    
    return { headers, data: results };
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    const str = String(value);
    
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
}

function writeCSV(headers, data, outputPath) {
    const headerLine = headers.map(h => escapeCSV(h)).join(',');
    const dataLines = data.map(row => {
        return headers.map(header => {
            const value = row[header] || '';
            return escapeCSV(value);
        }).join(',');
    });
    
    const csvContent = [headerLine, ...dataLines].join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf8');
}

// Main
const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('📖 Cách dùng:');
    console.log('   node scripts/merge-training-data.js <new-data.csv> [output.csv]');
    console.log('');
    console.log('📝 Ví dụ:');
    console.log('   # Merge vào ml-grader/grading_data.csv (mặc định)');
    console.log('   node scripts/merge-training-data.js training-data-2025-01-15T10-30-00.csv');
    console.log('');
    console.log('   # Merge vào file khác');
    console.log('   node scripts/merge-training-data.js training-data-2025-01-15T10-30-00.csv ml-grader/grading_data.csv');
    console.log('');
    console.log('💡 Tip: Dùng wildcard để merge nhiều file');
    console.log('   node scripts/merge-training-data.js training-data-*.csv');
    process.exit(1);
}

const newDataFile = args[0];
const outputFile = args[1] || path.join(__dirname, '../../ml-grader/grading_data.csv');

if (!fs.existsSync(newDataFile)) {
    console.error(`❌ File không tồn tại: ${newDataFile}`);
    process.exit(1);
}

console.log('🔄 Đang đọc dữ liệu mới...');
const newData = parseCSV(newDataFile);
console.log(`✅ Đã đọc ${newData.data.length} dòng từ file mới`);

// Kiểm tra file cũ có tồn tại không
let oldData = { headers: newData.headers, data: [] };
if (fs.existsSync(outputFile)) {
    console.log('🔄 Đang đọc dữ liệu cũ...');
    oldData = parseCSV(outputFile);
    console.log(`✅ Đã đọc ${oldData.data.length} dòng từ file cũ`);
} else {
    console.log('⚠️  File cũ không tồn tại, sẽ tạo file mới');
}

// Merge dữ liệu (bỏ duplicate dựa trên questionId + studentAnswer)
console.log('🔄 Đang merge dữ liệu...');
const mergedMap = new Map();

// Thêm dữ liệu cũ
oldData.data.forEach(row => {
    const key = `${row.questionId || ''}_${row.studentAnswer || ''}`;
    mergedMap.set(key, row);
});

// Thêm/update dữ liệu mới (dữ liệu mới sẽ ghi đè dữ liệu cũ nếu trùng)
let added = 0;
let updated = 0;
newData.data.forEach(row => {
    const key = `${row.questionId || ''}_${row.studentAnswer || ''}`;
    if (mergedMap.has(key)) {
        mergedMap.set(key, row); // Update
        updated++;
    } else {
        mergedMap.set(key, row); // Add new
        added++;
    }
});

const mergedData = Array.from(mergedMap.values());

console.log(`✅ Merge thành công:`);
console.log(`   - Tổng số dòng: ${mergedData.length}`);
console.log(`   - Thêm mới: ${added} dòng`);
console.log(`   - Cập nhật: ${updated} dòng`);
console.log(`   - Giữ nguyên: ${oldData.data.length - updated} dòng`);

// Lọc bỏ dòng không có teacherScore
const validData = mergedData.filter(row => {
    const score = row.teacherScore || '';
    return score.toString().trim() !== '' && !isNaN(parseFloat(score));
});

console.log(`\n📊 Dữ liệu hợp lệ (có teacherScore): ${validData.length}/${mergedData.length} dòng`);

// Ghi file
console.log(`\n💾 Đang ghi file: ${path.resolve(outputFile)}`);
writeCSV(newData.headers, mergedData, outputFile);

console.log('✅ Hoàn thành!');
console.log('\n💡 Bước tiếp theo:');
console.log('   cd ml-grader');
console.log('   python train_grader.py grading_data.csv');

