import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory with absolute path (CommonJS compatible)
const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'cv');

// Create directory if not exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✓ Created upload directory:', uploadDir);
    } catch (error) {
        console.error('❌ Error creating upload directory:', error);
    }
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure directory exists before saving
        if (!fs.existsSync(uploadDir)) {
            try {
                fs.mkdirSync(uploadDir, { recursive: true });
            } catch (error) {
                console.error('Error creating directory:', error);
            }
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        try {
            // Generate unique filename: userId_timestamp_originalname
            const userId = req.body.userId || 'user';
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            const nameWithoutExt = path.basename(file.originalname, ext);
            // Remove all special characters, spaces, and Vietnamese characters
            const sanitizedName = nameWithoutExt
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese diacritics
                .replace(/[^a-zA-Z0-9]/g, '_')    // Replace special chars with underscore
                .replace(/_+/g, '_');             // Replace multiple underscores with single
            
            const finalName = `${userId}_${timestamp}_${sanitizedName}${ext}`;
            console.log('💾 Saving file as:', finalName);
            cb(null, finalName);
        } catch (error) {
            console.error('Error generating filename:', error);
            cb(error);
        }
    }
});

// File filter - only accept PDF and DOC files
const fileFilter = (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file PDF, DOC, DOCX!'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    },
    fileFilter: fileFilter
});

export default upload;
