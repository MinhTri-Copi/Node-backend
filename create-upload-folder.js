const fs = require('fs');
const path = require('path');

// Đường dẫn tới thư mục uploads
const uploadDir = path.join(__dirname, 'src', 'public', 'uploads', 'cv');

console.log('🚀 Đang tạo thư mục upload...');
console.log('📁 Đường dẫn:', uploadDir);

try {
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✅ Tạo thư mục thành công!');
    } else {
        console.log('✅ Thư mục đã tồn tại!');
    }
    
    // Test quyền ghi
    const testFile = path.join(uploadDir, 'test_permission.txt');
    try {
        fs.writeFileSync(testFile, 'Testing write permission');
        fs.unlinkSync(testFile);
        console.log('✅ Quyền ghi file OK!');
        console.log('\n🎉 Setup hoàn tất! Có thể chạy server ngay.\n');
    } catch (writeError) {
        console.error('❌ Không có quyền ghi file!');
        console.error('❌ Lỗi:', writeError.message);
        console.error('\n⚠️  Giải pháp:');
        console.error('1. Chạy VS Code với quyền Administrator');
        console.error('2. Hoặc tạo thư mục thủ công và set permission:');
        console.error('   - Chuột phải vào thư mục cv');
        console.error('   - Properties → Security → Edit');
        console.error('   - Cho phép Full control cho user của bạn\n');
    }
} catch (error) {
    console.error('❌ Lỗi khi tạo thư mục!');
    console.error('❌ Chi tiết:', error.message);
    console.error('\n⚠️  Vui lòng:');
    console.error('1. Chạy VS Code với quyền Administrator');
    console.error('2. Kiểm tra antivirus có đang chặn không');
    console.error('3. Tạo thủ công thư mục: backend/src/public/uploads/cv\n');
}

