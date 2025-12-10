import fs from 'fs';
import path from 'path';
import db from '../models/index';
import mlTrainingService from '../service/mlTrainingService.js';

const DEFAULT_THRESHOLD = parseInt(process.env.AUTO_RETRAIN_THRESHOLD || '200', 10);
const DEFAULT_INTERVAL_MIN = parseInt(process.env.AUTO_RETRAIN_INTERVAL_MIN || '60', 10);
const CHECKPOINT_DIR = path.resolve(__dirname, '../tmp');
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, 'training_human_checkpoint.json');

const ensureDir = () => {
    if (!fs.existsSync(CHECKPOINT_DIR)) {
        fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }
};

const loadCheckpoint = () => {
    try {
        if (fs.existsSync(CHECKPOINT_PATH)) {
            const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('⚠️ Không đọc được checkpoint retrain:', e.message);
    }
    return { lastCount: 0, lastRetrainAt: null };
};

const saveCheckpoint = (data) => {
    ensureDir();
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2), 'utf8');
};

// Đếm số câu trả lời tự luận đã chấm (ưu tiên manual/hybrid)
const countHumanGradedAnswers = async () => {
    const whereAnswer = {
        Phuongphap: { [db.Sequelize.Op.in]: ['manual', 'hybrid'] }
    };

    const count = await db.TestAnswer.count({
        where: whereAnswer,
        include: [{
            model: db.TestQuestion,
            as: 'Question',
            required: true,
            where: { Loaicauhoi: 'tuluan' }
        }]
    });

    return count;
};

const maybeRetrain = async (threshold) => {
    try {
        const checkpoint = loadCheckpoint();
        const currentCount = await countHumanGradedAnswers();
        const delta = currentCount - (checkpoint.lastCount || 0);

        console.log(`🔍 Auto-retrain check | human graded: ${currentCount} | last: ${checkpoint.lastCount || 0} | delta: ${delta} | threshold: ${threshold}`);

        if (delta >= threshold && currentCount > 0) {
            console.log('🚀 Đủ ngưỡng mẫu human, bắt đầu train ML model...');
            const result = await mlTrainingService.trainMLModel(null, {});
            if (result?.success) {
                console.log('✅ Auto-retrain thành công:', result.message);
                saveCheckpoint({ lastCount: currentCount, lastRetrainAt: new Date().toISOString() });
            } else {
                console.warn('⚠️ Auto-retrain thất bại:', result?.message);
            }
        }
    } catch (err) {
        console.error('❌ Lỗi auto-retrain human model:', err.message);
    }
};

export const startHumanRetrainScheduler = ({
    threshold = DEFAULT_THRESHOLD,
    intervalMinutes = DEFAULT_INTERVAL_MIN
} = {}) => {
    console.log(`⏱️ Khởi động auto-retrain human model | threshold=${threshold} | interval=${intervalMinutes} phút`);
    // Lần đầu không train ngay, chỉ log và lưu checkpoint nếu chưa có
    const checkpoint = loadCheckpoint();
    if (!checkpoint.lastRetrainAt) {
        saveCheckpoint({ lastCount: checkpoint.lastCount || 0, lastRetrainAt: new Date().toISOString() });
    }

    setInterval(() => {
        maybeRetrain(threshold);
    }, intervalMinutes * 60 * 1000);
};


