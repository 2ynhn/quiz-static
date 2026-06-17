// GitHub Contents API로 문제은행 JSON을 커밋(소유자 토큰 필요). 공개 정보만 코드에 둔다(토큰은 localStorage).
import { GITHUB_REPO, GITHUB_BRANCH, BANK_PATHS } from '../constants.js';
import { loadDraft, mergeGeneral, mergeWordMap, clearDraft } from './bank.js';

// UTF-8 문자열 → base64 (GitHub Contents API는 base64 content를 요구)
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// 현재 파일 내용+sha 조회 (없으면 {data:null, sha:null})
async function getFile(token, path) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(`GitHub 조회 실패 (${res.status})`);
  const json = await res.json();
  let data = null;
  try {
    data = JSON.parse(fromBase64(json.content));
  } catch {
    data = null;
  }
  return { data, sha: json.sha };
}

async function putFile(token, path, contentObj, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: toBase64(JSON.stringify(contentObj, null, 2)),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const e = await res.json();
      if (e.message) msg = e.message;
    } catch {
      // ignore
    }
    throw new Error(`업로드 실패: ${msg}`);
  }
}

// 초안을 원격에 병합 커밋. 성공 시 초안 비움. 추가된 개수 반환.
export async function uploadBank(token) {
  const draft = loadDraft();
  const addG = draft.general.length;
  const addW = draft.wordcomplete.length;
  if (addG === 0 && addW === 0) {
    return { general: 0, wordcomplete: 0, skipped: true };
  }

  if (addG > 0) {
    const cur = await getFile(token, BANK_PATHS.general);
    const merged = mergeGeneral(cur.data, draft.general);
    await putFile(token, BANK_PATHS.general, merged, cur.sha, `bank: add ${addG} general Q`);
  }
  if (addW > 0) {
    const cur = await getFile(token, BANK_PATHS.wordcomplete);
    const merged = mergeWordMap(cur.data, draft.wordcomplete);
    await putFile(token, BANK_PATHS.wordcomplete, merged, cur.sha, `bank: add ${addW} word A`);
  }

  clearDraft();
  return { general: addG, wordcomplete: addW, skipped: false };
}

export { toBase64, fromBase64 };
