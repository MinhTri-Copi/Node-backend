/**
 * PHA B - Bước B1: Script tự động fetch từ API và convert sang CSV
 * 
 * Cách dùng:
 * node scripts/fetch-and-convert.js [output.csv] [apiUrl]
 * 
 * Mặc định:
 * - output.csv: training-data.csv
 * - apiUrl: http://localhost:8082/api/debug/export-answers
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Hàm escape CSV
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

// Hàm fetch từ API
function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (error) {
                    reject(new Error(`Lỗi parse JSON: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Hàm chuyển đổi JSON sang CSV
function jsonToCSV(jsonData, outputPath) {
    if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
        console.error('❌ Dữ liệu JSON không hợp lệ hoặc rỗng');
        return false;
    }

    const headers = ['questionId', 'questionText', 'correctAnswer', 'studentAnswer', 'maxScore', 'teacherScore'];
    const headerLine = headers.map(h => escapeCSV(h)).join(',');

    const dataLines = jsonData.map(row => {
        return headers.map(header => {
            const value = row[header] || row[header.toLowerCase()] || '';
            return escapeCSV(value);
        }).join(',');
    });

    const csvContent = [headerLine, ...dataLines].join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    
    return true;
}

// Main
const args = process.argv.slice(2);
// Tự động tạo tên file với timestamp nếu không chỉ định
let outputFile = args[0];
if (!outputFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outputFile = `training-data-${timestamp}.csv`;
}
const apiUrl = args[1] || 'http://localhost:8082/api/debug/export-answers';

console.log('🔄 Đang fetch dữ liệu từ API...');
console.log(`   URL: ${apiUrl}`);

fetchFromAPI(apiUrl)
    .then(response => {
        if (!response.success) {
            console.error('❌ API trả về lỗi:', response.message || 'Unknown error');
            process.exit(1);
        }

        const jsonData = response.data || [];
        console.log(`✅ Đã fetch ${jsonData.length} dòng dữ liệu`);

        if (jsonData.length === 0) {
            console.warn('⚠️  Không có dữ liệu để export');
            process.exit(0);
        }

        console.log('🔄 Đang chuyển đổi sang CSV...');
        const success = jsonToCSV(jsonData, outputFile);

        if (success) {
            console.log(`✅ Đã tạo file CSV: ${path.resolve(outputFile)}`);
            console.log(`📊 Tổng số dòng: ${jsonData.length}`);
        } else {
            console.error('❌ Lỗi khi tạo file CSV');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Lỗi:', error.message);
        console.log('');
        console.log('💡 Gợi ý:');
        console.log('   1. Kiểm tra backend đã chạy chưa (http://localhost:8082)');
        console.log('   2. Kiểm tra API endpoint: /api/debug/export-answers');
        process.exit(1);
    });

