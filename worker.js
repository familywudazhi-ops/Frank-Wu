/*
  Cloudflare Worker API for Trade Balance Live.
  Bind a D1 database as `DB`, then deploy this Worker beside index.html.
  Keep any AI provider key in Worker secrets; never place it in index.html.
*/

const QUESTIONS = [
  { id: 'q1', correct: 0 }, { id: 'q2', correct: 0 }, { id: 'q3', correct: 2 },
  { id: 'q4', correct: 3 }, { id: 'q5', correct: 0 }, { id: 'q6', correct: 1 },
  { id: 'q7', correct: 2 }, { id: 'q8', correct: 3 }
];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  });
}

function id(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function code() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSession(env, joinCode) {
  return env.DB.prepare('SELECT * FROM class_sessions WHERE join_code = ?').bind(joinCode).first();
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (request.method === 'POST' && url.pathname === '/api/session') {
        const body = await request.json();
        let joinCode = code();
        while (await getSession(env, joinCode)) joinCode = code();
        const sessionId = id('session');
        await env.DB.prepare('INSERT INTO class_sessions (id, join_code, teacher_name, language) VALUES (?, ?, ?, ?)')
          .bind(sessionId, joinCode, body.teacherName || '教師', 'zh').run();
        return json({ session: { id: sessionId, code: joinCode, status: 'lobby', questionIndex: 0, language: 'zh' } });
      }

      if (parts[0] === 'api' && parts[1] === 'session' && parts[2]) {
        const joinCode = parts[2].toUpperCase();
        const session = await getSession(env, joinCode);
        if (!session) return json({ error: 'session_not_found' }, 404);

        if (request.method === 'POST' && parts[3] === 'join') {
          const body = await request.json();
          const playerId = id('player');
          await env.DB.prepare('INSERT INTO players (id, session_id, nickname) VALUES (?, ?, ?)')
            .bind(playerId, session.id, String(body.nickname || '學生').slice(0, 32)).run();
          return json({ session: { code: session.join_code, status: session.status, questionIndex: session.question_index, language: session.language || 'zh' }, player: { id: playerId, name: body.nickname || '學生' } });
        }

        if (request.method === 'POST' && parts[3] === 'language') {
          const body = await request.json();
          const language = body.language === 'en' ? 'en' : 'zh';
          await env.DB.prepare('UPDATE class_sessions SET language = ? WHERE id = ?').bind(language, session.id).run();
          return json({ ok: true, language });
        }

        if (request.method === 'POST' && parts[3] === 'start') {
          await env.DB.prepare("UPDATE class_sessions SET status = 'playing', question_index = 0, started_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id).run();
          return json({ ok: true });
        }

        if (request.method === 'POST' && parts[3] === 'advance') {
          const body = await request.json();
          const nextIndex = Math.max(0, QUESTIONS.findIndex(q => q.id === body.questionId));
          await env.DB.prepare('UPDATE class_sessions SET question_index = ? WHERE id = ?').bind(nextIndex, session.id).run();
          return json({ ok: true, questionIndex: nextIndex });
        }

        if (request.method === 'POST' && parts[3] === 'answer') {
          const body = await request.json();
          const q = QUESTIONS.find(x => x.id === body.questionId);
          if (!q) return json({ error: 'question_not_found' }, 400);
          const isCorrect = Number(body.answer) === q.correct ? 1 : 0;
          const speed = Math.max(0, 20000 - Number(body.responseTimeMs || 0));
          const score = isCorrect ? 1000 + Math.min(300, Math.round(speed / 66.7)) : 0;
          await env.DB.prepare('INSERT INTO question_attempts (session_id, player_id, question_id, answer_index, is_correct, response_time_ms, score_awarded) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(session.id, body.playerId, q.id, Number(body.answer), isCorrect, Number(body.responseTimeMs || 0), score).run();
          await env.DB.prepare('UPDATE players SET total_score = total_score + ? WHERE id = ? AND session_id = ?').bind(score, body.playerId, session.id).run();
          return json({ ok: true, correct: Boolean(isCorrect), score });
        }

        if (request.method === 'GET' && !parts[3]) {
          const players = await env.DB.prepare('SELECT id, nickname, total_score FROM players WHERE session_id = ? ORDER BY total_score DESC LIMIT 100').bind(session.id).all();
          return json({ session: { code: session.join_code, status: session.status, questionIndex: session.question_index, language: session.language || 'zh' }, players: players.results });
        }
      }
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      return json({ error: 'server_error', message: error.message }, 500);
    }
  }
};

