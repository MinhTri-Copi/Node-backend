import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-12345';

// Create reusable transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

/**
 * Send email notification to candidate when application is approved
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @returns {Promise<boolean>} - Success status
 */
const sendApprovalEmail = async (candidateInfo, jobInfo, companyInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo hồ sơ đã được duyệt - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo hồ sơ đã được duyệt</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo hồ sơ đã được duyệt
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Hồ sơ ứng tuyển của bạn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong> đã được duyệt.
        </p>

        <p>
            Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất để thông tin thêm về
            các bước tiếp theo. Vui lòng kiểm tra email và điện thoại thường xuyên.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
};

/**
 * Send email notification to candidate when application is rejected
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @returns {Promise<boolean>} - Success status
 */
const sendRejectionEmail = async (candidateInfo, jobInfo, companyInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo kết quả ứng tuyển - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo kết quả ứng tuyển</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo kết quả ứng tuyển
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Cảm ơn bạn đã quan tâm và ứng tuyển vào vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            Sau khi xem xét hồ sơ, chúng tôi rất tiếc phải thông báo rằng lần này hồ sơ của bạn
            chưa phù hợp với yêu cầu của vị trí.
        </p>

        <p>
            Chúng tôi hy vọng sẽ có cơ hội được xem xét hồ sơ của bạn cho những vị trí khác
            phù hợp hơn trong tương lai.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
};

const sendTestAssignmentEmail = async (candidateInfo, jobInfo, testInfo, companyInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;
        const { testTitle, deadline, duration } = testInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo bài test mới cho vị trí ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo bài test mới</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo bài test mới
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Bạn có một bài test mới cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            <strong>Tên bài test:</strong> ${testTitle}<br />
            <strong>Thời gian làm bài:</strong> ${duration} phút<br />
            <strong>Hạn hoàn thành:</strong> ${deadline || 'Không giới hạn'}
        </p>

        <p>Vui lòng đăng nhập vào trang ứng viên để bắt đầu làm bài test.</p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending test assignment email:', error);
        return false;
    }
};

/**
 * Send email notification to candidate when they are approved for interview
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} interviewRoundInfo - Interview round information (optional)
 * @returns {Promise<boolean>} - Success status
 */
const sendInterviewNotificationEmail = async (candidateInfo, jobInfo, companyInfo, interviewRoundInfo = null) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo bạn được mời phỏng vấn - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo mời phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo mời phỏng vấn
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Bạn đã được chọn vào vòng phỏng vấn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        ${
            interviewRoundInfo
                ? `<p><strong>Thông tin vòng phỏng vấn:</strong><br />
            - Vòng: ${interviewRoundInfo.roundNumber}<br />
            - Tên vòng: ${interviewRoundInfo.title}${
                      interviewRoundInfo.duration
                          ? `<br />- Thời lượng dự kiến: ${interviewRoundInfo.duration} phút`
                          : ''
                  }${
                      interviewRoundInfo.description
                          ? `<br />- Nội dung: ${interviewRoundInfo.description}`
                          : ''
                  }</p>`
                : `<p>Thông tin chi tiết về vòng phỏng vấn sẽ được bộ phận tuyển dụng gửi cho bạn trong thời gian tới.</p>`
        }

        <p>
            HR sẽ liên hệ với bạn qua email để sắp xếp lịch phỏng vấn. Vui lòng kiểm tra email
            thường xuyên.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending interview notification email:', error);
        return false;
    }
};

/**
 * Generate JWT token for interview invitation
 * @param {number} meetingId - Meeting ID
 * @returns {string} JWT token
 */
const generateInterviewToken = (meetingId) => {
    try {
        const payload = {
            meetingId: meetingId,
            type: 'interview_invitation'
        };
        // Token expires in 30 days
        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: '30d'
        });
        return token;
    } catch (error) {
        console.error('Error generating interview token:', error);
        throw error;
    }
};

/**
 * Send email notification to candidate when meeting is created
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} meetingInfo - Meeting information (roomName, scheduledAt, interviewRound, meetingId)
 * @param {string} meetingLink - Link to meeting page (e.g., https://your-app.com/meeting/phongpv-123abc)
 * @param {string} interviewToken - JWT token for interview verification (optional, will be generated if not provided)
 * @returns {Promise<{success: boolean, token?: string}>} - Success status and token
 */
const sendMeetingInvitationEmail = async (candidateInfo, jobInfo, companyInfo, meetingInfo, meetingLink, interviewToken = null) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;
        const { roomName, scheduledAt, interviewRound, meetingId } = meetingInfo;

        // Generate token if not provided
        let token = interviewToken;
        if (!token && meetingId) {
            token = generateInterviewToken(meetingId);
        }

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // Generate response links
        // Note: These links should point to frontend pages that handle the API calls
        // For now, using backend API directly (frontend should create pages to handle these)
        const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8080';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Option 1: Direct API links (less user-friendly, but works)
        // const confirmLink = token ? `${backendUrl}/api/interview/response` : '#';
        // const rejectLink = token ? `${backendUrl}/api/interview/response` : '#';
        
        // Option 2: Frontend page links (better UX - frontend should create these pages)
        const confirmLink = token ? `${frontendUrl}/interview/confirm?token=${token}` : '#';
        const rejectLink = token ? `${frontendUrl}/interview/reject?token=${token}` : '#';

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thư mời phỏng vấn - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thư mời phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thư mời phỏng vấn
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Bạn được mời tham gia buổi phỏng vấn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            <strong>Thông tin phỏng vấn:</strong><br />
            - Thời gian: ${formatDate(scheduledAt)}<br />
            ${
                interviewRound
                    ? `- Vòng phỏng vấn: Vòng ${interviewRound.roundNumber} - ${interviewRound.title}<br />${
                          interviewRound.duration
                              ? `- Thời lượng dự kiến: ${interviewRound.duration} phút<br />`
                              : ''
                      }`
                    : ''
            }
        </p>

        <div style="margin:24px 0;padding:16px;background-color:#f8f9fa;border-radius:8px;border-left:4px solid #008060;">
            <p style="margin:0 0 12px 0;font-weight:600;color:#333;">
                Vui lòng xác nhận tham gia phỏng vấn:
            </p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <a href="${confirmLink}" 
                   style="display:inline-block;padding:12px 24px;background-color:#008060;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;text-align:center;">
                    ✓ Xác nhận tham gia
                </a>
                <a href="${rejectLink}" 
                   style="display:inline-block;padding:12px 24px;background-color:#dc3545;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;text-align:center;">
                    ✗ Từ chối / Đổi lịch
                </a>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;color:#666;">
                Lưu ý: Bạn có thể từ chối/đổi lịch tối đa 2 lần. Sau lần thứ 3, đơn ứng tuyển sẽ bị hủy.
            </p>
            <p style="margin:12px 0 0 0;font-size:13px;color:#008060;font-weight:600;">
                ⚠️ Link tham gia phỏng vấn sẽ được gửi đến bạn sau khi bạn xác nhận tham gia.
            </p>
        </div>

        <p>
            Vui lòng kiểm tra trước kết nối internet, micro và camera, và tham gia đúng giờ.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return {
            success: true,
            token: token || null
        };
    } catch (error) {
        console.error('❌ Error sending meeting invitation email:', error);
        return {
            success: false,
            token: null
        };
    }
};

/**
 * Send email with meeting link to candidate after they confirm attendance
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} meetingInfo - Meeting information (roomName, scheduledAt, meetingUrl, interviewRound)
 * @returns {Promise<boolean>} - Success status
 */
const sendMeetingLinkEmail = async (candidateInfo, jobInfo, companyInfo, meetingInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;
        const { roomName, scheduledAt, meetingUrl, interviewRound } = meetingInfo;

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Link tham gia phỏng vấn - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Link tham gia phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Link tham gia phỏng vấn
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Cảm ơn bạn đã xác nhận tham gia phỏng vấn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            <strong>Thông tin phỏng vấn:</strong><br />
            - Thời gian: ${formatDate(scheduledAt)}<br />
            ${
                interviewRound
                    ? `- Vòng phỏng vấn: Vòng ${interviewRound.roundNumber} - ${interviewRound.title}<br />${
                          interviewRound.duration
                              ? `- Thời lượng dự kiến: ${interviewRound.duration} phút<br />`
                              : ''
                      }`
                    : ''
            }
        </p>

        ${meetingUrl ? `
        <div style="margin:24px 0;padding:20px;background-color:#f0f9ff;border-radius:8px;border:2px solid #008060;">
            <p style="margin:0 0 16px 0;font-weight:600;color:#333;font-size:16px;">
                🔗 Link tham gia phỏng vấn (Jitsi):
            </p>
            <p style="margin:12px 0;font-size:14px;color:#666;word-break:break-all;">
                <a href="${meetingUrl}" target="_blank" style="color:#008060;text-decoration:underline;font-size:15px;font-weight:500;">${meetingUrl}</a>
            </p>
            <p style="margin:8px 0 0 0;font-size:13px;color:#666;">
                Vui lòng copy link trên và tham gia đúng giờ đã hẹn.
            </p>
        </div>
        ` : `
        <div style="margin:24px 0;padding:20px;background-color:#fff3cd;border-radius:8px;border:2px solid #ffc107;">
            <p style="margin:0;font-size:14px;color:#856404;">
                ⚠️ Link tham gia phỏng vấn chưa được tạo. Vui lòng liên hệ HR để được hỗ trợ.
            </p>
        </div>
        `}

        <div style="margin:24px 0;padding:16px;background-color:#fff3cd;border-radius:8px;border-left:4px solid #ffc107;">
            <p style="margin:0;font-size:14px;color:#856404;">
                <strong>Lưu ý quan trọng:</strong><br />
                - Vui lòng kiểm tra kết nối internet, micro và camera trước khi tham gia<br />
                - Tham gia đúng giờ đã hẹn<br />
                - Đảm bảo môi trường yên tĩnh và ánh sáng đầy đủ<br />
                - Chuẩn bị sẵn CV và các tài liệu liên quan (nếu có)
            </p>
        </div>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email với link meet đã được gửi thành công:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending meeting link email:', error);
        return false;
    }
};

/**
 * Send email notification to candidate when they pass an interview round and move to next round
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} currentRoundInfo - Current round information (roundNumber, title)
 * @param {object} nextRoundInfo - Next round information (roundNumber, title, duration, description)
 * @returns {Promise<boolean>} - Success status
 */
const sendInterviewPassEmail = async (candidateInfo, jobInfo, companyInfo, currentRoundInfo, nextRoundInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo bạn đã vượt qua vòng ${currentRoundInfo.roundNumber} - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo vượt qua vòng phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo vượt qua vòng phỏng vấn
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Bạn đã vượt qua vòng ${currentRoundInfo.roundNumber}${
                    currentRoundInfo.title ? ` - ${currentRoundInfo.title}` : ''
                } cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            Bạn sẽ tiếp tục vào vòng ${nextRoundInfo.roundNumber} với thông tin như sau:<br />
            - Tên vòng: ${nextRoundInfo.title}<br />
            ${nextRoundInfo.duration ? `- Thời lượng dự kiến: ${nextRoundInfo.duration} phút<br />` : ''}
            ${nextRoundInfo.description ? `- Nội dung: ${nextRoundInfo.description}<br />` : ''}
        </p>

        <p>
            HR sẽ liên hệ với bạn qua email để sắp xếp lịch phỏng vấn cho vòng tiếp theo.
            Vui lòng kiểm tra email thường xuyên.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending interview pass email:', error);
        return false;
    }
};

/**
 * Send email notification to candidate when they are hired (passed all interview rounds)
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} lastRoundInfo - Last round information (roundNumber, title)
 * @returns {Promise<boolean>} - Success status
 */
const sendHiringCongratulationsEmail = async (candidateInfo, jobInfo, companyInfo, lastRoundInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo bạn đã được tuyển dụng - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo tuyển dụng</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #008060;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#008060;">
            Thông báo bạn đã được tuyển dụng
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Chúng tôi trân trọng thông báo bạn đã vượt qua tất cả các vòng phỏng vấn và
            được tuyển dụng cho vị trí <strong>"${Tieude}"</strong> tại
            <strong>${Tencongty}</strong>.
        </p>

        ${
            lastRoundInfo
                ? `<p>Vòng phỏng vấn cuối cùng: Vòng ${lastRoundInfo.roundNumber}${
                      lastRoundInfo.title ? ` - ${lastRoundInfo.title}` : ''
                  }.</p>`
                : ''
        }

        <p>
            Trong thời gian tới, bộ phận nhân sự sẽ liên hệ với bạn để trao đổi chi tiết về
            thời gian nhận việc, quy trình onboarding và các giấy tờ cần chuẩn bị.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending hiring congratulations email:', error);
        return false;
    }
};

/**
 * Send email notification to HR when candidate requests reschedule
 * @param {object} hrInfo - HR information
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} meetingInfo - Meeting information (scheduledAt, interviewRound)
 * @param {string} reason - Reschedule reason from candidate
 * @returns {Promise<boolean>} - Success status
 */
const sendRescheduleRequestEmail = async (hrInfo, candidateInfo, jobInfo, companyInfo, meetingInfo, reason) => {
    try {
        const { email: hrEmail, Hoten: hrName } = hrInfo;
        const { email: candidateEmail, Hoten: candidateName } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;
        const { scheduledAt, interviewRound } = meetingInfo;

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: hrEmail,
            subject: `Yêu cầu đổi lịch phỏng vấn - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Yêu cầu đổi lịch phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #ff9800;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#ff9800;">
            Yêu cầu đổi lịch phỏng vấn
        </h2>

        <p>Xin chào ${hrName},</p>

        <p>
            Ứng viên <strong>${candidateName}</strong> (${candidateEmail}) đã yêu cầu đổi lịch phỏng vấn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong>.
        </p>

        <p>
            <strong>Thông tin buổi phỏng vấn hiện tại:</strong><br />
            - Thời gian: ${formatDate(scheduledAt)}<br />
            ${
                interviewRound
                    ? `- Vòng phỏng vấn: Vòng ${interviewRound.roundNumber} - ${interviewRound.title}<br />`
                    : ''
            }
        </p>

        <div style="margin:16px 0;padding:16px;background-color:#fff3cd;border-radius:6px;border-left:4px solid #ffc107;">
            <p style="margin:0 0 8px 0;font-weight:600;color:#856404;">
                Lý do từ ứng viên:
            </p>
            <p style="margin:0;color:#856404;white-space:pre-wrap;">
                ${reason || 'Không có lý do cụ thể'}
            </p>
        </div>

        <p>
            Vui lòng đăng nhập vào hệ thống để sắp xếp lại lịch phỏng vấn mới cho ứng viên.
        </p>

        <p>Trân trọng,<br />Hệ thống Tuyển dụng</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Reschedule request email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending reschedule request email:', error);
        return false;
    }
};

/**
 * Send termination email to candidate when they exceed reschedule limit
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @returns {Promise<boolean>} - Success status
 */
const sendTerminationEmail = async (candidateInfo, jobInfo, companyInfo) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;

        const mailOptions = {
            from: `"${Tencongty}" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Thông báo hủy quy trình phỏng vấn - ${Tieude}`,
            html: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Thông báo hủy quy trình phỏng vấn</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:24px auto;padding:24px;background-color:#ffffff;border-radius:8px;border-top:4px solid #dc3545;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#dc3545;">
            Thông báo hủy quy trình phỏng vấn
        </h2>

        <p>Xin chào ${Hoten},</p>

        <p>
            Chúng tôi rất tiếc phải thông báo rằng quy trình phỏng vấn của bạn cho vị trí
            <strong>"${Tieude}"</strong> tại <strong>${Tencongty}</strong> đã bị hủy.
        </p>

        <div style="margin:16px 0;padding:16px;background-color:#f8d7da;border-radius:6px;border-left:4px solid #dc3545;">
            <p style="margin:0;color:#721c24;font-weight:600;">
                Lý do: Bạn đã từ chối/đổi lịch phỏng vấn quá 3 lần.
            </p>
        </div>

        <p>
            Theo quy định của công ty, ứng viên chỉ được phép từ chối hoặc yêu cầu đổi lịch phỏng vấn tối đa 2 lần.
            Sau lần thứ 3, quy trình phỏng vấn sẽ tự động bị hủy.
        </p>

        <p>
            Chúng tôi hy vọng sẽ có cơ hội được xem xét hồ sơ của bạn cho những vị trí khác
            phù hợp hơn trong tương lai.
        </p>

        <p>Trân trọng,<br />${Tencongty}</p>

        <p style="font-size:12px;color:#777;margin-top:24px;">
            (Email được gửi tự động, vui lòng không trả lời email này)
        </p>
    </div>
</body>
</html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Termination email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending termination email:', error);
        return false;
    }
};

export default {
    sendApprovalEmail,
    sendRejectionEmail,
    sendTestAssignmentEmail,
    sendInterviewNotificationEmail,
    sendMeetingInvitationEmail,
    sendMeetingLinkEmail,
    sendInterviewPassEmail,
    sendHiringCongratulationsEmail,
    sendRescheduleRequestEmail,
    sendTerminationEmail,
    generateInterviewToken
};

