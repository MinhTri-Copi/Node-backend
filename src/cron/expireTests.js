import db from '../models/index';
import { Op } from 'sequelize';

const DEFAULT_INTERVAL_MIN = parseInt(process.env.EXPIRE_TEST_INTERVAL_MIN || '10', 10);

/**
 * Đặt Trangthai = 0 cho các bài test đã hết hạn (Ngayhethan < now) nhưng vẫn đang active.
 */
const deactivateExpiredTests = async () => {
    const now = new Date();
    const [affected] = await db.Test.update(
        { Trangthai: 0 },
        {
            where: {
                Trangthai: 1,
                Ngayhethan: { [Op.lt]: now }
            }
        }
    );
    if (affected > 0) {
        console.log(`⌛ Đã tự động tắt ${affected} bài test đã hết hạn.`);
    }
};

export const startExpireTestScheduler = (intervalMinutes = DEFAULT_INTERVAL_MIN) => {
    const interval = parseInt(intervalMinutes, 10);
    console.log(`⏱️ Scheduler tắt bài test hết hạn | interval=${interval} phút`);

    // Chạy ngay 1 lần khi khởi động
    deactivateExpiredTests().catch(err => {
        console.error('❌ Lỗi khi tắt bài test hết hạn (lần đầu):', err.message);
    });

    setInterval(() => {
        deactivateExpiredTests().catch(err => {
            console.error('❌ Lỗi khi tắt bài test hết hạn:', err.message);
        });
    }, interval * 60 * 1000);
};

export default {
    startExpireTestScheduler
};

