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

export default {
    sendApprovalEmail,
    sendRejectionEmail,
    sendTestAssignmentEmail
};

