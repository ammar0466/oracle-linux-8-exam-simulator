// Cloudflare Pages Function: /api/progress
// Handles saving exam attempts and tracking confidence/mastery per question

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = JSON.parse(atob(token));
    if (payload.exp && payload.exp > Date.now()) {
      return payload;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = verifyToken(request.headers.get('Authorization'));

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;

  try {
    const body = await request.json();
    const { 
      score, 
      total_questions, 
      percentage, 
      passed, 
      time_taken_seconds, 
      mode, 
      question_results // Array of { question_id: int, is_correct: bool }
    } = body;

    const attemptId = 'att_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // 1. Insert Exam Attempt Record
    await db.prepare(`
      INSERT INTO exam_attempts (id, user_id, score, total_questions, percentage, passed, time_taken_seconds, mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attemptId,
      user.id,
      score,
      total_questions,
      percentage,
      passed ? 1 : 0,
      time_taken_seconds,
      mode || 'exam'
    ).run();

    // 2. Update Question Mastery & Confidence Counter
    if (Array.isArray(question_results) && question_results.length > 0) {
      const statements = [];
      for (const res of question_results) {
        const qId = parseInt(res.question_id, 10);
        const isCorrect = Boolean(res.is_correct);

        const incCorrect = isCorrect ? 1 : 0;
        const incIncorrect = isCorrect ? 0 : 1;

        statements.push(
          db.prepare(`
            INSERT INTO question_mastery (user_id, question_id, times_correct, times_incorrect, last_answered_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, question_id) DO UPDATE SET
              times_correct = times_correct + ?,
              times_incorrect = times_incorrect + ?,
              last_answered_at = CURRENT_TIMESTAMP
          `).bind(user.id, qId, incCorrect, incIncorrect, incCorrect, incIncorrect)
        );
      }

      // Execute batch updates
      if (statements.length > 0) {
        await db.batch(statements);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Progress recorded successfully',
      attempt_id: attemptId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = verifyToken(request.headers.get('Authorization'));

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;

  try {
    // 1. Overall stats
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_attempts,
        MAX(percentage) as best_score,
        AVG(percentage) as avg_score,
        SUM(passed) as total_passed
      FROM exam_attempts
      WHERE user_id = ?
    `).bind(user.id).first();

    // 2. Recent attempts
    const recentAttempts = await db.prepare(`
      SELECT id, score, total_questions, percentage, passed, time_taken_seconds, mode, created_at
      FROM exam_attempts
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(user.id).all();

    // 3. Question Mastery (Confident = times_correct >= 2)
    const masteryData = await db.prepare(`
      SELECT question_id, times_correct, times_incorrect, last_answered_at
      FROM question_mastery
      WHERE user_id = ?
    `).bind(user.id).all();

    const masteryRows = masteryData.results || [];
    const confidentQuestions = masteryRows.filter(m => m.times_correct >= 2).map(m => m.question_id);
    const learningQuestions = masteryRows.filter(m => m.times_correct === 1).map(m => m.question_id);
    const strugglingQuestions = masteryRows.filter(m => m.times_incorrect > m.times_correct).map(m => m.question_id);

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      stats: {
        total_attempts: stats?.total_attempts || 0,
        best_score: stats?.best_score || 0,
        avg_score: Math.round(stats?.avg_score || 0),
        total_passed: stats?.total_passed || 0,
        confident_count: confidentQuestions.length,
        learning_count: learningQuestions.length,
        total_questions: 60
      },
      confident_question_ids: confidentQuestions,
      learning_question_ids: learningQuestions,
      struggling_question_ids: strugglingQuestions,
      recent_attempts: recentAttempts.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
