import db from '../models/index';

/**
 * 1️⃣ Candidate submits test - save all answers
 */
const submitTest = async (userId, submissionId, answers) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        // Validate submission exists and belongs to user
        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId, userId },
            include: [{
                model: db.Test,
                as: 'Test',
                include: [{
                    model: db.TestQuestion,
                    as: 'Questions'
                }]
            }],
            transaction
        });

        if (!submission) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 1,
                DT: null
            };
        }

        if (submission.Trangthai === 'danop' || submission.Trangthai === 'dacham') {
            await transaction.rollback();
            return {
                EM: 'Bài test đã được nộp rồi!',
                EC: 2,
                DT: null
            };
        }

        // Validate answers format
        if (!answers || typeof answers !== 'object') {
            await transaction.rollback();
            return {
                EM: 'Dữ liệu câu trả lời không hợp lệ!',
                EC: 3,
                DT: null
            };
        }

        const questionIds = submission.Test.Questions.map(q => q.id);
        const answerEntries = Object.entries(answers);

        // Save all answers
        const savedAnswers = [];
        for (const [questionId, answerText] of answerEntries) {
            const qId = parseInt(questionId);
            
            if (!questionIds.includes(qId)) {
                continue; // Skip invalid question IDs
            }

            const existingAnswer = await db.TestAnswer.findOne({
                where: {
                    testSubmissionId: submissionId,
                    testQuestionId: qId
                },
                transaction
            });

            if (existingAnswer) {
                // Update existing answer
                await existingAnswer.update({
                    Cautraloi: answerText || '',
                    Phuongphap: 'manual'
                }, { transaction });
                savedAnswers.push(existingAnswer);
            } else {
                // Create new answer
                const newAnswer = await db.TestAnswer.create({
                    testSubmissionId: submissionId,
                    testQuestionId: qId,
                    Cautraloi: answerText || '',
                    Diemdatduoc: 0,
                    Dungkhong: false,
                    Phuongphap: 'manual'
                }, { transaction });
                savedAnswers.push(newAnswer);
            }
        }

        // Update submission status
        await submission.update({
            Trangthai: 'danop',
            Thoigianketthuc: new Date()
        }, { transaction });

        await transaction.commit();

        return {
            EM: 'Nộp bài test thành công!',
            EC: 0,
            DT: {
                submissionId: submission.id,
                answersCount: savedAnswers.length,
                submittedAt: new Date()
            }
        };

    } catch (error) {
        await transaction.rollback();
        console.error('Error in submitTest:', error);
        return {
            EM: 'Có lỗi xảy ra khi nộp bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * 2️⃣ HR grades individual answer
 */
const gradeAnswer = async (hrUserId, answerId, scoreData) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { Diemdatduoc, Nhanxet, Dungkhong } = scoreData;

        // Get answer with question info
        const answer = await db.TestAnswer.findOne({
            where: { id: answerId },
            include: [
                {
                    model: db.TestQuestion,
                    as: 'Question',
                    attributes: ['id', 'Diem', 'Cauhoi']
                },
                {
                    model: db.TestSubmission,
                    as: 'Submission',
                    attributes: ['id', 'Trangthai', 'testId']
                }
            ],
            transaction
        });

        if (!answer) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy câu trả lời!',
                EC: 1,
                DT: null
            };
        }

        if (answer.Submission.Trangthai !== 'danop' && answer.Submission.Trangthai !== 'dacham') {
            await transaction.rollback();
            return {
                EM: 'Chỉ có thể chấm bài đã nộp!',
                EC: 2,
                DT: null
            };
        }

        // Validate score
        const maxScore = answer.Question.Diem;
        if (Diemdatduoc < 0 || Diemdatduoc > maxScore) {
            await transaction.rollback();
            return {
                EM: `Điểm phải từ 0 đến ${maxScore}!`,
                EC: 3,
                DT: null
            };
        }

        const oldScore = answer.Diemdatduoc;

        // Update answer score
        await answer.update({
            Diemdatduoc: Diemdatduoc,
            Nhanxet: Nhanxet || null,
            Dungkhong: Dungkhong || false,
            Phuongphap: 'manual'
        }, { transaction });

        // 3️⃣ Log grading history
        await db.GradingLog.create({
            testAnswerId: answerId,
            Phuongphap: 'manual',
            Diemcu: oldScore,
            Diemmoi: Diemdatduoc,
            Lydocham: Nhanxet || 'Chấm điểm thủ công',
            Nguoicham: hrUserId
        }, { transaction });

        await transaction.commit();

        return {
            EM: 'Chấm điểm thành công!',
            EC: 0,
            DT: {
                answerId: answer.id,
                oldScore,
                newScore: Diemdatduoc
            }
        };

    } catch (error) {
        await transaction.rollback();
        console.error('Error in gradeAnswer:', error);
        return {
            EM: 'Có lỗi xảy ra khi chấm điểm!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * 4️⃣ HR finalizes grading - calculate total score
 */
const finalizeGrading = async (hrUserId, submissionId) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        // Get submission with all answers
        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId },
            include: [
                {
                    model: db.TestAnswer,
                    as: 'Answers',
                    attributes: ['id', 'Diemdatduoc', 'testQuestionId']
                },
                {
                    model: db.Test,
                    as: 'Test',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Questions',
                        attributes: ['id']
                    }]
                }
            ],
            transaction
        });

        if (!submission) {
            await transaction.rollback();
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 1,
                DT: null
            };
        }

        if (submission.Trangthai !== 'danop' && submission.Trangthai !== 'dacham') {
            await transaction.rollback();
            return {
                EM: 'Chỉ có thể hoàn tất chấm bài đã nộp!',
                EC: 2,
                DT: null
            };
        }

        // Check if all questions have been answered
        const totalQuestions = submission.Test.Questions.length;
        const answeredQuestions = submission.Answers.length;

        if (answeredQuestions < totalQuestions) {
            await transaction.rollback();
            return {
                EM: `Ứng viên chưa trả lời đủ câu hỏi! (${answeredQuestions}/${totalQuestions})`,
                EC: 3,
                DT: null
            };
        }

        // Calculate total score
        const totalScore = submission.Answers.reduce((sum, answer) => {
            return sum + (answer.Diemdatduoc || 0);
        }, 0);

        // Update submission with final score
        await submission.update({
            Tongdiemdatduoc: totalScore,
            Trangthai: 'dacham',
            Ghichu: `Chấm điểm hoàn tất bởi HR (ID: ${hrUserId}) vào ${new Date().toLocaleString('vi-VN')}`
        }, { transaction });

        await transaction.commit();

        return {
            EM: 'Hoàn tất chấm bài thành công!',
            EC: 0,
            DT: {
                submissionId: submission.id,
                totalScore: totalScore,
                totalQuestions: totalQuestions,
                gradedBy: hrUserId,
                gradedAt: new Date()
            }
        };

    } catch (error) {
        await transaction.rollback();
        console.error('Error in finalizeGrading:', error);
        return {
            EM: 'Có lỗi xảy ra khi hoàn tất chấm bài!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get submission detail for grading (HR view)
 */
const getSubmissionForGrading = async (hrUserId, submissionId) => {
    try {
        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId },
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    attributes: ['id', 'Tieude', 'Tongdiem'],
                    include: [{
                        model: db.JobPosting,
                        as: 'JobPosting',
                        attributes: ['id', 'Tieude'],
                        include: [{
                            model: db.Company,
                            attributes: ['id', 'Tencongty']
                        }]
                    }]
                },
                {
                    model: db.User,
                    as: 'User',
                    attributes: ['id', 'Ten', 'Email']
                },
                {
                    model: db.JobApplication,
                    as: 'JobApplication',
                    attributes: ['id']
                },
                {
                    model: db.TestAnswer,
                    as: 'Answers',
                    include: [
                        {
                            model: db.TestQuestion,
                            as: 'Question',
                            attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem', 'Thutu']
                        },
                        {
                            model: db.GradingLog,
                            as: 'GradingLogs',
                            include: [{
                                model: db.User,
                                as: 'Grader',
                                attributes: ['id', 'Ten', 'Email']
                            }],
                            order: [['createdAt', 'DESC']]
                        }
                    ],
                    order: [['testQuestionId', 'ASC']]
                }
            ]
        });

        if (!submission) {
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 1,
                DT: null
            };
        }

        // Verify HR has access to this submission
        const test = submission.Test;
        const jobPosting = test?.JobPosting;
        
        if (!jobPosting) {
            return {
                EM: 'Không tìm thấy thông tin tin tuyển dụng!',
                EC: 2,
                DT: null
            };
        }

        // Check if HR owns this job posting
        const recruiter = await db.Recruiter.findOne({
            where: { userId: hrUserId, companyId: jobPosting.Company.id }
        });

        if (!recruiter) {
            return {
                EM: 'Bạn không có quyền chấm bài test này!',
                EC: 3,
                DT: null
            };
        }

        return {
            EM: 'Lấy thông tin bài test thành công!',
            EC: 0,
            DT: submission
        };

    } catch (error) {
        console.error('Error in getSubmissionForGrading:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy thông tin bài test!',
            EC: -1,
            DT: null
        };
    }
};

/**
 * Get submission result (for candidate or HR)
 */
const getSubmissionResult = async (userId, submissionId, isHR = false) => {
    try {
        const submission = await db.TestSubmission.findOne({
            where: { id: submissionId },
            include: [
                {
                    model: db.Test,
                    as: 'Test',
                    attributes: ['id', 'Tieude', 'Tongdiem']
                },
                {
                    model: db.TestAnswer,
                    as: 'Answers',
                    include: [{
                        model: db.TestQuestion,
                        as: 'Question',
                        attributes: ['id', 'Cauhoi', 'Dapan', 'Loaicauhoi', 'Diem']
                    }]
                }
            ]
        });

        if (!submission) {
            return {
                EM: 'Không tìm thấy bài test!',
                EC: 1,
                DT: null
            };
        }

        // Verify access
        if (!isHR && submission.userId !== userId) {
            return {
                EM: 'Bạn không có quyền xem kết quả này!',
                EC: 2,
                DT: null
            };
        }

        // Only show results if graded
        if (submission.Trangthai !== 'dacham') {
            return {
                EM: 'Bài test chưa được chấm điểm!',
                EC: 3,
                DT: null
            };
        }

        return {
            EM: 'Lấy kết quả bài test thành công!',
            EC: 0,
            DT: submission
        };

    } catch (error) {
        console.error('Error in getSubmissionResult:', error);
        return {
            EM: 'Có lỗi xảy ra khi lấy kết quả bài test!',
            EC: -1,
            DT: null
        };
    }
};

export default {
    submitTest,
    gradeAnswer,
    finalizeGrading,
    getSubmissionForGrading,
    getSubmissionResult
};

