import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory for question banks
const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'question-banks');

// Create directory if not exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✓ Created question bank upload directory:', uploadDir);
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
            console.log('💾 Saving question bank file as:', finalName);
            cb(null, finalName);
        } catch (error) {
            console.error('Error generating filename:', error);
            cb(error);
        }
    }
});

// File filter - accept TXT, PDF, DOC, DOCX
const fileFilter = (req, file, cb) => {
    const allowedTypes = /txt|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype === 'text/plain' || 
                     file.mimetype === 'application/pdf' ||
                     file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (mimetype || extname) {
        return cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file TXT, PDF, DOC, DOCX!'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size (larger than CV because question banks can be bigger)
    },
    fileFilter: fileFilter
});

export default upload;

