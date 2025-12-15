import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

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
 * Send email notification to candidate when meeting is created
 * @param {object} candidateInfo - Candidate information
 * @param {object} jobInfo - Job posting information
 * @param {object} companyInfo - Company information
 * @param {object} meetingInfo - Meeting information (roomName, scheduledAt, interviewRound)
 * @param {string} meetingLink - Link to meeting page (e.g., https://your-app.com/meeting/phongpv-123abc)
 * @returns {Promise<boolean>} - Success status
 */
const sendMeetingInvitationEmail = async (candidateInfo, jobInfo, companyInfo, meetingInfo, meetingLink) => {
    try {
        const { email, Hoten } = candidateInfo;
        const { Tieude } = jobInfo;
        const { Tencongty } = companyInfo;
        const { roomName, scheduledAt, interviewRound } = meetingInfo;

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

        <p>
            <strong>Link tham gia phỏng vấn:</strong><br />
            <a href="${meetingLink}" target="_blank" style="color:#008060;text-decoration:none;">
                ${meetingLink}
            </a>
        </p>

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
        return true;
    } catch (error) {
        console.error('❌ Error sending meeting invitation email:', error);
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

export default {
    sendApprovalEmail,
    sendRejectionEmail,
    sendTestAssignmentEmail,
    sendInterviewNotificationEmail,
    sendMeetingInvitationEmail,
    sendInterviewPassEmail,
    sendHiringCongratulationsEmail
};

