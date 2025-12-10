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
            subject: `🎉 Chúc mừng! Hồ sơ của bạn đã được duyệt - ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 10px;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .job-info {
                            background: #f8f9fa;
                            border-left: 4px solid #667eea;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .job-info strong {
                            color: #667eea;
                        }
                        .next-steps {
                            background: #e8f4f8;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .next-steps h3 {
                            color: #2c3e50;
                            margin-top: 0;
                        }
                        .next-steps ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .next-steps li {
                            margin: 8px 0;
                            color: #555;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #667eea;
                            font-weight: bold;
                        }
                        .highlight {
                            background: linear-gradient(120deg, #ffd89b 0%, #19547b 100%);
                            background-clip: text;
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🎉</div>
                            <h1>Chúc Mừng!</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <p class="message">
                                Chúng tôi rất vui mừng thông báo rằng hồ sơ ứng tuyển của bạn đã được 
                                <span class="highlight">XÉT DUYỆT THÀNH CÔNG</span>! 🎊
                            </p>
                            
                            <div class="job-info">
                                <p><strong>📋 Vị trí ứng tuyển:</strong> ${Tieude}</p>
                                <p><strong>🏢 Công ty:</strong> ${Tencongty}</p>
                            </div>
                            
                            <div class="next-steps">
                                <h3>📌 Các bước tiếp theo:</h3>
                                <ul>
                                    <li>Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất</li>
                                    <li>Vui lòng kiểm tra email và điện thoại thường xuyên</li>
                                    <li>Chuẩn bị các giấy tờ cần thiết cho buổi phỏng vấn</li>
                                    <li>Tìm hiểu thêm về công ty và vị trí ứng tuyển</li>
                                </ul>
                            </div>
                            
                            <p class="message">
                                Chúng tôi đánh giá cao sự quan tâm của bạn đối với vị trí này và mong được 
                                gặp bạn trong buổi phỏng vấn sắp tới!
                            </p>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .job-info {
                            background: #f8f9fa;
                            border-left: 4px solid #667eea;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .encouragement {
                            background: #fff3cd;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                            border-left: 4px solid #ffc107;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #667eea;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Thông báo kết quả ứng tuyển</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <p class="message">
                                Cảm ơn bạn đã quan tâm và ứng tuyển vào vị trí tại công ty chúng tôi.
                            </p>
                            
                            <div class="job-info">
                                <p><strong>📋 Vị trí ứng tuyển:</strong> ${Tieude}</p>
                                <p><strong>🏢 Công ty:</strong> ${Tencongty}</p>
                            </div>
                            
                            <p class="message">
                                Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng lần này 
                                hồ sơ của bạn chưa phù hợp với yêu cầu của vị trí.
                            </p>
                            
                            <div class="encouragement">
                                <p style="margin: 0;">
                                    💪 <strong>Đừng nản lòng!</strong> Chúng tôi khuyến khích bạn tiếp tục 
                                    theo dõi và ứng tuyển vào các vị trí khác phù hợp hơn trong tương lai. 
                                    Chúc bạn sớm tìm được công việc mơ ước!
                                </p>
                            </div>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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
            subject: `📝 Bạn có bài test mới cho vị trí ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
                            border-radius: 10px;
                            padding: 30px;
                            color: white;
                        }
                        .content {
                            background: white;
                            border-radius: 10px;
                            padding: 30px;
                            margin-top: 20px;
                            color: #1f2937;
                        }
                        .highlight {
                            font-weight: bold;
                            color: #2563eb;
                        }
                        .btn {
                            display: inline-block;
                            padding: 12px 24px;
                            background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
                            color: white;
                            text-decoration: none;
                            border-radius: 8px;
                            margin-top: 20px;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>📩 Bạn có bài test mới!</h2>
                        <p>Xin chào <strong>${Hoten}</strong>,</p>
                        <p>
                            Hồ sơ của bạn cho vị trí <strong>${Tieude}</strong> đã được duyệt
                            và chúng tôi muốn mời bạn hoàn thành bài test tiếp theo.
                        </p>
                        <div class="content">
                            <p><span class="highlight">Tên bài test:</span> ${testTitle}</p>
                            <p><span class="highlight">Thời gian làm bài:</span> ${duration} phút</p>
                            <p><span class="highlight">Hạn hoàn thành:</span> ${deadline || 'Không giới hạn'}</p>
                            <p>Vui lòng đăng nhập vào trang ứng viên để bắt đầu làm bài test.</p>
                        </div>
                        <p>Có thắc mắc gì, hãy phản hồi email này. Chúc bạn hoàn thành tốt bài test!</p>
                        <p>Trân trọng,<br/>${Tencongty}</p>
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
            subject: `🎯 Thông báo: Bạn đã được chọn vào vòng phỏng vấn - ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #008060 0%, #2bab60 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 10px;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .job-info {
                            background: #f8f9fa;
                            border-left: 4px solid #008060;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .job-info strong {
                            color: #008060;
                        }
                        .interview-info {
                            background: #e8f5e9;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                            border: 2px solid #008060;
                        }
                        .interview-info h3 {
                            color: #008060;
                            margin-top: 0;
                            font-size: 20px;
                        }
                        .interview-info p {
                            margin: 8px 0;
                            color: #555;
                        }
                        .highlight-box {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .highlight-box strong {
                            color: #856404;
                        }
                        .next-steps {
                            background: #e8f4f8;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .next-steps h3 {
                            color: #2c3e50;
                            margin-top: 0;
                        }
                        .next-steps ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .next-steps li {
                            margin: 8px 0;
                            color: #555;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #008060;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🎯</div>
                            <h1>Chúc Mừng!</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <p class="message">
                                Chúng tôi rất vui mừng thông báo rằng bạn đã vượt qua vòng đánh giá và 
                                được chọn vào <strong>vòng phỏng vấn</strong> cho vị trí:
                            </p>
                            
                            <div class="job-info">
                                <p style="margin: 0;"><strong>Vị trí ứng tuyển:</strong> ${Tieude}</p>
                                <p style="margin: 0;"><strong>Công ty:</strong> ${Tencongty}</p>
                            </div>

                            ${interviewRoundInfo ? `
                            <div class="interview-info">
                                <h3>📋 Thông tin vòng phỏng vấn</h3>
                                <p><strong>Vòng:</strong> Vòng ${interviewRoundInfo.roundNumber}</p>
                                <p><strong>Tên vòng:</strong> ${interviewRoundInfo.title}</p>
                                ${interviewRoundInfo.duration ? `<p><strong>Thời lượng dự kiến:</strong> ${interviewRoundInfo.duration} phút</p>` : ''}
                                ${interviewRoundInfo.description ? `<p><strong>Nội dung:</strong> ${interviewRoundInfo.description}</p>` : ''}
                            </div>
                            ` : ''}

                            <div class="highlight-box">
                                <p style="margin: 0;">
                                    <strong>📧 Lưu ý quan trọng:</strong> Chủ yếu là HR sẽ liên hệ sớm với bạn qua email. 
                                    Vui lòng kiểm tra email thường xuyên để không bỏ lỡ thông tin quan trọng!
                                </p>
                            </div>
                            
                            <div class="next-steps">
                                <h3>📌 Các bước tiếp theo:</h3>
                                <ul>
                                    <li><strong>Kiểm tra email thường xuyên</strong> - HR sẽ gửi thông tin chi tiết về lịch phỏng vấn qua email</li>
                                    <li>Chuẩn bị các giấy tờ cần thiết (CV, bằng cấp, chứng chỉ...)</li>
                                    <li>Tìm hiểu thêm về công ty và vị trí ứng tuyển</li>
                                    <li>Chuẩn bị các câu hỏi bạn muốn hỏi nhà tuyển dụng</li>
                                    <li>Đảm bảo kết nối internet ổn định nếu phỏng vấn online</li>
                                </ul>
                            </div>
                            
                            <p class="message">
                                Chúng tôi đánh giá cao sự quan tâm của bạn đối với vị trí này và mong được 
                                gặp bạn trong buổi phỏng vấn sắp tới!
                            </p>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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
            subject: `📅 Thư mời phỏng vấn - ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #008060 0%, #2bab60 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 10px;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .meeting-info {
                            background: #e8f5e9;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                            border: 2px solid #008060;
                        }
                        .meeting-info h3 {
                            color: #008060;
                            margin-top: 0;
                            font-size: 20px;
                        }
                        .meeting-info p {
                            margin: 8px 0;
                            color: #555;
                        }
                        .meeting-link-box {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 4px;
                            text-align: center;
                        }
                        .meeting-link-box a {
                            display: inline-block;
                            padding: 15px 30px;
                            background: linear-gradient(135deg, #008060, #2bab60);
                            color: white;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 16px;
                            margin-top: 10px;
                            box-shadow: 0 4px 12px rgba(0, 128, 96, 0.3);
                        }
                        .meeting-link-box a:hover {
                            opacity: 0.9;
                        }
                        .highlight-box {
                            background: #e3f2fd;
                            border-left: 4px solid #2196f3;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .highlight-box strong {
                            color: #1976d2;
                        }
                        .next-steps {
                            background: #f3e5f5;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .next-steps h3 {
                            color: #7b1fa2;
                            margin-top: 0;
                        }
                        .next-steps ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .next-steps li {
                            margin: 8px 0;
                            color: #555;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #008060;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">📅</div>
                            <h1>Thư Mời Phỏng Vấn</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <p class="message">
                                Chúng tôi rất vui mừng thông báo rằng bạn đã được chọn vào vòng phỏng vấn. 
                                Chúng tôi xin mời bạn tham gia buổi phỏng vấn trực tuyến cho vị trí:
                            </p>
                            
                            <div class="meeting-info">
                                <h3>📋 Thông tin phỏng vấn</h3>
                                <p><strong>Vị trí:</strong> ${Tieude}</p>
                                <p><strong>Công ty:</strong> ${Tencongty}</p>
                                ${interviewRound ? `<p><strong>Vòng phỏng vấn:</strong> Vòng ${interviewRound.roundNumber} - ${interviewRound.title}</p>` : ''}
                                <p><strong>Thời gian:</strong> ${formatDate(scheduledAt)}</p>
                                ${interviewRound && interviewRound.duration ? `<p><strong>Thời lượng dự kiến:</strong> ${interviewRound.duration} phút</p>` : ''}
                            </div>

                            <div class="meeting-link-box">
                                <p style="margin: 0 0 10px 0; color: #856404; font-weight: 600;">
                                    🔗 Link tham gia phỏng vấn:
                                </p>
                                <a href="${meetingLink}" target="_blank">
                                    Tham gia phỏng vấn ngay
                                </a>
                                <p style="margin-top: 15px; font-size: 13px; color: #666;">
                                    Hoặc copy link: <br/>
                                    <span style="word-break: break-all; color: #008060;">${meetingLink}</span>
                                </p>
                            </div>

                            <div class="highlight-box">
                                <p style="margin: 0;">
                                    <strong>💡 Lưu ý:</strong> Vui lòng click vào link trên để tham gia phỏng vấn. 
                                    Link sẽ mở trong trình duyệt và tự động kết nối với phòng phỏng vấn.
                                </p>
                            </div>
                            
                            <div class="next-steps">
                                <h3>📌 Chuẩn bị trước khi phỏng vấn:</h3>
                                <ul>
                                    <li>Kiểm tra kết nối internet ổn định</li>
                                    <li>Chuẩn bị webcam và microphone</li>
                                    <li>Chuẩn bị các giấy tờ cần thiết (CV, bằng cấp, chứng chỉ...)</li>
                                    <li>Tham gia đúng giờ hoặc sớm hơn 5-10 phút</li>
                                    <li>Tìm hiểu thêm về công ty và vị trí ứng tuyển</li>
                                    <li>Chuẩn bị các câu hỏi bạn muốn hỏi nhà tuyển dụng</li>
                                </ul>
                            </div>
                            
                            <p class="message">
                                Chúng tôi rất mong được gặp bạn trong buổi phỏng vấn sắp tới. 
                                Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email này.
                            </p>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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
            subject: `🎉 Chúc mừng! Bạn đã vượt qua vòng ${currentRoundInfo.roundNumber} - ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 28px;
                            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 10px;
                        }
                        .greeting {
                            font-size: 18px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .job-info {
                            background: #f8f9fa;
                            border-left: 4px solid #667eea;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .job-info strong {
                            color: #667eea;
                        }
                        .success-box {
                            background: #d4edda;
                            border-left: 4px solid #28a745;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .success-box h3 {
                            color: #155724;
                            margin-top: 0;
                            font-size: 20px;
                        }
                        .next-round-info {
                            background: #e8f5e9;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                            border: 2px solid #28a745;
                        }
                        .next-round-info h3 {
                            color: #28a745;
                            margin-top: 0;
                            font-size: 20px;
                        }
                        .next-round-info p {
                            margin: 8px 0;
                            color: #555;
                        }
                        .highlight-box {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .highlight-box strong {
                            color: #856404;
                        }
                        .next-steps {
                            background: #e8f4f8;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .next-steps h3 {
                            color: #2c3e50;
                            margin-top: 0;
                        }
                        .next-steps ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .next-steps li {
                            margin: 8px 0;
                            color: #555;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #667eea;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🎉</div>
                            <h1>Chúc Mừng!</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <div class="success-box">
                                <h3>✅ Bạn đã vượt qua vòng ${currentRoundInfo.roundNumber}!</h3>
                                <p style="margin: 0; color: #155724;">
                                    Chúng tôi rất ấn tượng với kết quả phỏng vấn của bạn ở vòng ${currentRoundInfo.roundNumber}${currentRoundInfo.title ? ` - ${currentRoundInfo.title}` : ''}.
                                </p>
                            </div>
                            
                            <p class="message">
                                Chúng tôi rất vui mừng thông báo rằng bạn đã được chọn để tiếp tục vào <strong>vòng ${nextRoundInfo.roundNumber}</strong> cho vị trí:
                            </p>
                            
                            <div class="job-info">
                                <p style="margin: 0;"><strong>Vị trí ứng tuyển:</strong> ${Tieude}</p>
                                <p style="margin: 0;"><strong>Công ty:</strong> ${Tencongty}</p>
                            </div>

                            <div class="next-round-info">
                                <h3>📋 Thông tin vòng phỏng vấn tiếp theo</h3>
                                <p><strong>Vòng:</strong> Vòng ${nextRoundInfo.roundNumber}</p>
                                <p><strong>Tên vòng:</strong> ${nextRoundInfo.title}</p>
                                ${nextRoundInfo.duration ? `<p><strong>Thời lượng dự kiến:</strong> ${nextRoundInfo.duration} phút</p>` : ''}
                                ${nextRoundInfo.description ? `<p><strong>Nội dung:</strong> ${nextRoundInfo.description}</p>` : ''}
                            </div>

                            <div class="highlight-box">
                                <p style="margin: 0;">
                                    <strong>📧 Lưu ý quan trọng:</strong> HR sẽ liên hệ sớm với bạn qua email để sắp xếp lịch phỏng vấn cho vòng ${nextRoundInfo.roundNumber}. 
                                    Vui lòng kiểm tra email thường xuyên để không bỏ lỡ thông tin quan trọng!
                                </p>
                            </div>
                            
                            <div class="next-steps">
                                <h3>📌 Các bước tiếp theo:</h3>
                                <ul>
                                    <li><strong>Kiểm tra email thường xuyên</strong> - HR sẽ gửi thông tin chi tiết về lịch phỏng vấn vòng ${nextRoundInfo.roundNumber} qua email</li>
                                    <li>Chuẩn bị các giấy tờ cần thiết (CV, bằng cấp, chứng chỉ...)</li>
                                    <li>Tìm hiểu thêm về công ty và vị trí ứng tuyển</li>
                                    <li>Chuẩn bị các câu hỏi bạn muốn hỏi nhà tuyển dụng</li>
                                    <li>Đảm bảo kết nối internet ổn định nếu phỏng vấn online</li>
                                </ul>
                            </div>
                            
                            <p class="message">
                                Chúng tôi đánh giá cao sự quan tâm và nỗ lực của bạn. Chúc bạn tiếp tục thành công ở vòng phỏng vấn tiếp theo!
                            </p>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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
            subject: `🎊 Chúc mừng! Bạn đã được tuyển dụng - ${Tieude}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                            border-radius: 10px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            background: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin-top: 20px;
                        }
                        .header {
                            text-align: center;
                            color: white;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 32px;
                            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .icon {
                            font-size: 80px;
                            margin-bottom: 10px;
                        }
                        .greeting {
                            font-size: 20px;
                            color: #2c3e50;
                            margin-bottom: 20px;
                            font-weight: 600;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 25px;
                            line-height: 1.8;
                        }
                        .congratulations-box {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border-radius: 8px;
                            padding: 30px;
                            margin: 20px 0;
                            text-align: center;
                        }
                        .congratulations-box h2 {
                            margin: 0 0 15px 0;
                            font-size: 28px;
                        }
                        .congratulations-box p {
                            margin: 10px 0;
                            font-size: 18px;
                        }
                        .job-info {
                            background: #f8f9fa;
                            border-left: 4px solid #f5576c;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .job-info strong {
                            color: #f5576c;
                        }
                        .highlight-box {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                        .highlight-box h3 {
                            color: #856404;
                            margin-top: 0;
                            font-size: 18px;
                        }
                        .highlight-box p {
                            margin: 8px 0;
                            color: #856404;
                        }
                        .next-steps {
                            background: #e8f4f8;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .next-steps h3 {
                            color: #2c3e50;
                            margin-top: 0;
                        }
                        .next-steps ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .next-steps li {
                            margin: 8px 0;
                            color: #555;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #eee;
                            color: #777;
                            font-size: 14px;
                        }
                        .company-name {
                            color: #f5576c;
                            font-weight: bold;
                            font-size: 18px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🎊</div>
                            <h1>Chúc Mừng!</h1>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Xin chào <strong>${Hoten}</strong>,</p>
                            
                            <div class="congratulations-box">
                                <h2>🎉 Bạn đã được tuyển dụng!</h2>
                                <p>
                                    Chúng tôi rất vui mừng thông báo rằng bạn đã vượt qua tất cả các vòng phỏng vấn 
                                    và được chọn cho vị trí:
                                </p>
                                <p style="font-size: 22px; font-weight: 600; margin-top: 15px;">
                                    ${Tieude}
                                </p>
                                <p style="font-size: 16px; margin-top: 10px;">
                                    tại <strong>${Tencongty}</strong>
                                </p>
                            </div>
                            
                            <p class="message">
                                Kết quả này là minh chứng cho năng lực, kinh nghiệm và sự phù hợp của bạn với vị trí này. 
                                Chúng tôi tin rằng bạn sẽ là một thành viên tuyệt vời trong đội ngũ của chúng tôi.
                            </p>
                            
                            <div class="job-info">
                                <p style="margin: 0;"><strong>Vị trí:</strong> ${Tieude}</p>
                                <p style="margin: 0;"><strong>Công ty:</strong> ${Tencongty}</p>
                                ${lastRoundInfo ? `<p style="margin: 0;"><strong>Vòng phỏng vấn cuối:</strong> Vòng ${lastRoundInfo.roundNumber}${lastRoundInfo.title ? ` - ${lastRoundInfo.title}` : ''}</p>` : ''}
                            </div>

                            <div class="highlight-box">
                                <h3>📧 Thông tin quan trọng</h3>
                                <p>
                                    HR sẽ liên hệ với bạn trong thời gian sớm nhất qua email để thông báo chi tiết về:
                                </p>
                                <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
                                    <li>Thời gian và địa điểm làm việc</li>
                                    <li>Quy trình onboarding</li>
                                    <li>Các giấy tờ cần chuẩn bị</li>
                                    <li>Thông tin về mức lương và phúc lợi</li>
                                </ul>
                                <p style="margin-top: 15px; font-weight: 600;">
                                    Vui lòng kiểm tra email thường xuyên để không bỏ lỡ thông tin quan trọng!
                                </p>
                            </div>
                            
                            <div class="next-steps">
                                <h3>📌 Các bước tiếp theo:</h3>
                                <ul>
                                    <li><strong>Kiểm tra email thường xuyên</strong> - HR sẽ gửi thông tin chi tiết về quy trình onboarding</li>
                                    <li>Chuẩn bị các giấy tờ cần thiết (CMND/CCCD, bằng cấp, chứng chỉ, sơ yếu lý lịch...)</li>
                                    <li>Thông báo cho công ty hiện tại (nếu có) về quyết định nghỉ việc</li>
                                    <li>Tìm hiểu thêm về công ty, văn hóa làm việc và đội ngũ</li>
                                    <li>Chuẩn bị tinh thần và sẵn sàng cho ngày đầu tiên đi làm</li>
                                </ul>
                            </div>
                            
                            <p class="message">
                                Một lần nữa, chúng tôi xin chúc mừng bạn và rất mong được chào đón bạn vào đội ngũ của chúng tôi!
                            </p>
                            
                            <div class="footer">
                                <p>Trân trọng,</p>
                                <p class="company-name">${Tencongty}</p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    Email này được gửi tự động. Vui lòng không trả lời email này.
                                </p>
                            </div>
                        </div>
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

