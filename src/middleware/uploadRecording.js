import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory for recordings
const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'recordings');

// Create directory if not exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✓ Created recording upload directory:', uploadDir);
    } catch (error) {
        console.error('❌ Error creating recording upload directory:', error);
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
            // Generate unique filename: meetingId_timestamp.webm
            const meetingId = req.body.meetingId || 'meeting';
            const timestamp = Date.now();
            const ext = path.extname(file.originalname) || '.webm';
            
            const finalName = `meeting-${meetingId}-${timestamp}${ext}`;
            console.log('💾 Saving recording file as:', finalName);
            cb(null, finalName);
        } catch (error) {
            console.error('Error generating filename:', error);
            cb(error);
        }
    }
});

// File filter - only accept video files
const fileFilter = (req, file, cb) => {
    const allowedTypes = /webm|mp4|mkv|avi|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/') || allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file video (webm, mp4, mkv, avi, mov)!'));
    }
};

// Configure multer - allow larger files for video (500MB max)
const uploadRecording = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max file size for video
    },
    fileFilter: fileFilter
});

export default uploadRecording;

