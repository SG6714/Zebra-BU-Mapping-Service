import { Router, Request, Response } from 'express';
import { requireUiAuth, setUiSession, clearUiSession, checkPassword } from '../middleware/uiAuth';
import * as hierarchyService from '../services/hierarchyService';
import { HierarchyPath } from '../services/hierarchyService';
import { IHierarchyNode } from '../models/HierarchyNode';

const router = Router();

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f8;color:#1a1a2e;font-size:15px;line-height:1.5}
a{color:#0078d4;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:860px;margin:0 auto;padding:24px 16px}
nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid #dde1e7}
.logo{font-weight:700;font-size:1.05rem;color:#1a1a2e;letter-spacing:.01em}
h1{font-size:1.25rem;margin-bottom:18px}
h2{font-size:1rem;margin:0 0 10px;color:#333}
.card{background:#fff;border:1px solid #dde1e7;border-radius:8px;padding:18px 20px;margin-bottom:14px}
label{display:block;font-size:.82rem;font-weight:600;color:#555;margin-bottom:4px}
input[type=text],input[type=email],input[type=password],select{width:100%;padding:7px 10px;border:1px solid #ccc;border-radius:4px;font-size:.93rem;background:#fafafa;margin-bottom:10px}
input:focus,select:focus{outline:none;border-color:#0078d4;background:#fff}
.btn{display:inline-block;padding:7px 16px;background:#0078d4;color:#fff;border:none;border-radius:4px;font-size:.88rem;cursor:pointer}
.btn:hover{background:#005fa3}.btn-sm{padding:4px 11px;font-size:.8rem}
.btn-ghost{background:transparent;color:#0078d4;border:1px solid #0078d4}.btn-ghost:hover{background:#e8f0fe}
.btn-danger{background:#c0392b}.btn-danger:hover{background:#a93226}
.btn-secondary{background:#6c757d}.btn-secondary:hover{background:#545b62}
.flash{padding:10px 14px;border-radius:5px;margin-bottom:16px;font-size:.9rem;border:1px solid transparent}
.flash-err{background:#f8d7da;border-color:#f5c2c7;color:#842029}
.flash-ok{background:#d1e7dd;border-color:#badbcc;color:#0f5132}
.badge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-right:8px}
.b-sp{background:#e3f2fd;color:#0d47a1}.b-bu{background:#e8f5e9;color:#1b5e20}
.b-team{background:#fff8e1;color:#e65100}.b-group{background:#fce4ec;color:#880e4f}
.meta{color:#777;font-size:.82rem;margin-bottom:6px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.divider{border:none;border-top:1px solid #eee;margin:14px 0}
.search-row{display:flex;gap:8px}
.search-row input{margin-bottom:0;flex:1}
details summary{cursor:pointer;font-size:.85rem;color:#0078d4;font-weight:600;padding:4px 0}
details[open] summary{margin-bottom:10px}
`;

function page(title: string, body: string, flash?: { msg: string; type: 'err' | 'ok' }): string {
  const flashHtml = flash
    ? `<div class="flash flash-${flash.type}">${escHtml(flash.msg)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} – BU Mapping</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${flashHtml}
${body}
</div>
</body>
</html>`;
}

function navBar(loggedIn: boolean): string {
  return `<nav>
  <span class="logo"><span aria-hidden="true">🦓</span> BU Mapping Admin</span>
  ${loggedIn ? '<a href="/ui/logout" class="btn btn-sm btn-secondary">Logout</a>' : ''}
</nav>`;
}

function badgeClass(type: string): string {
  const map: Record<string, string> = {
    strategic_pillar: 'b-sp',
    business_unit: 'b-bu',
    team: 'b-team',
    group: 'b-group',
  };
  return map[type] ?? 'b-group';
}

function badgeLabel(type: string): string {
  const map: Record<string, string> = {
    strategic_pillar: 'Strategic Pillar',
    business_unit: 'Business Unit',
    team: 'Team',
    group: 'Group',
  };
  return map[type] ?? type;
}

function nodeCard(node: Partial<IHierarchyNode>, userEmail: string, isMemberNode: boolean): string {
  const nodeId = escHtml(node.id ?? '');
  const nodeName = escHtml(node.name ?? '');
  const leaderEmail = escHtml(node.leader_email ?? '');
  const type = node.type ?? '';

  return `<div class="card">
  <div class="row" style="margin-bottom:8px">
    <span class="badge ${badgeClass(type)}">${escHtml(badgeLabel(type))}</span>
    <strong style="font-size:1rem">${nodeName}</strong>
    ${isMemberNode ? '<span class="meta">(current assignment)</span>' : ''}
  </div>
  <p class="meta">Leader: <strong>${leaderEmail}</strong></p>
  <hr class="divider">
  <details>
    <summary>Edit Leader</summary>
    <form method="POST" action="/ui/update/leader">
      <input type="hidden" name="nodeId" value="${nodeId}">
      <input type="hidden" name="email" value="${escHtml(userEmail)}">
      <label>New leader email</label>
      <input type="email" name="leaderEmail" value="${leaderEmail}" required>
      <button type="submit" class="btn btn-sm">Save Leader</button>
    </form>
  </details>
  <details style="margin-top:8px">
    <summary>Rename Node</summary>
    <form method="POST" action="/ui/update/name">
      <input type="hidden" name="nodeId" value="${nodeId}">
      <input type="hidden" name="email" value="${escHtml(userEmail)}">
      <label>New name</label>
      <input type="text" name="name" value="${nodeName}" required>
      <button type="submit" class="btn btn-sm">Save Name</button>
    </form>
  </details>
</div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function backUrl(email: string | undefined, flash: string, ft: 'ok' | 'err'): string {
  const emailPart = email ? `email=${encodeURIComponent(email)}&` : '';
  return `/ui?${emailPart}flash=${encodeURIComponent(flash)}&ft=${ft}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /ui/login
router.get('/login', (req: Request, res: Response) => {
  const flash = req.query.err ? { msg: String(req.query.err), type: 'err' as const } : undefined;
  res.send(
    page(
      'Login',
      `${navBar(false)}
<div style="max-width:360px;margin:60px auto">
  <div class="card">
    <h1>Admin Login</h1>
    <form method="POST" action="/ui/login">
      <label>Password</label>
      <input type="password" name="password" autofocus required>
      <button type="submit" class="btn" style="width:100%">Log In</button>
    </form>
  </div>
</div>`,
      flash
    )
  );
});

// POST /ui/login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (password && checkPassword(password)) {
    setUiSession(res);
    res.redirect('/ui');
    return;
  }
  res.redirect('/ui/login?err=Invalid+password');
});

// GET /ui/logout
router.get('/logout', (_req: Request, res: Response) => {
  clearUiSession(res);
  res.redirect('/ui/login');
});

// GET /ui  — search form + results
router.get('/', requireUiAuth, async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const flashMsg = typeof req.query.flash === 'string' ? req.query.flash : '';
  const flashType = typeof req.query.ft === 'string' && req.query.ft === 'err' ? 'err' : 'ok';
  const flash = flashMsg ? { msg: flashMsg, type: flashType as 'err' | 'ok' } : undefined;

  let resultsHtml = '';

  if (email) {
    const hierarchy: HierarchyPath | null = await hierarchyService.getUserHierarchy(email);
    const memberNode: IHierarchyNode | null = await hierarchyService.getUserMemberNode(email);

    if (!hierarchy) {
      resultsHtml = `<div class="flash flash-err">No hierarchy found for <strong>${escHtml(email)}</strong>.</div>`;
    } else {
      const levels: Array<keyof Omit<HierarchyPath, 'member_email'>> = [
        'group',
        'team',
        'business_unit',
        'strategic_pillar',
      ];

      const cards = levels
        .filter((l) => hierarchy[l])
        .map((l) => {
          const node = hierarchy[l] as Partial<IHierarchyNode>;
          const isMember = memberNode != null && node.id === memberNode.id;
          return nodeCard(node, email, isMember);
        })
        .join('');

      // Build reassign dropdown
      const allNodes: IHierarchyNode[] = await hierarchyService.getAllNodes();
      const nodeOptions = allNodes
        .map(
          (n) =>
            `<option value="${escHtml(n.id)}"${memberNode?.id === n.id ? ' selected' : ''}>${escHtml(badgeLabel(n.type))}: ${escHtml(n.name)}</option>`
        )
        .join('');

      const reassignSection =
        allNodes.length > 0
          ? `<div class="card">
  <h2>Reassign User</h2>
  <p class="meta" style="margin-bottom:10px">Move <strong>${escHtml(email)}</strong> to a different node</p>
  <form method="POST" action="/ui/update/member">
    <input type="hidden" name="email" value="${escHtml(email)}">
    <label>Move to node</label>
    <select name="newNodeId">${nodeOptions}</select>
    <button type="submit" class="btn">Reassign</button>
  </form>
</div>`
          : '';

      resultsHtml = `
<p class="meta" style="margin-bottom:14px">Showing hierarchy for <strong>${escHtml(email)}</strong></p>
${cards}
${reassignSection}`;
    }
  }

  const searchValue = email ? ` value="${escHtml(email)}"` : '';

  res.send(
    page(
      'Search',
      `${navBar(true)}
<h1>Search User</h1>
<div class="card">
  <form method="GET" action="/ui">
    <label>Employee email</label>
    <div class="search-row">
      <input type="email" name="email" placeholder="user@example.com"${searchValue} autofocus required>
      <button type="submit" class="btn">Search</button>
    </div>
  </form>
</div>
${resultsHtml}`,
      flash
    )
  );
});

// POST /ui/update/leader
router.post('/update/leader', requireUiAuth, async (req: Request, res: Response) => {
  const { nodeId, leaderEmail, email } = req.body as {
    nodeId?: string;
    leaderEmail?: string;
    email?: string;
  };
  const back = (flash: string, ft: 'ok' | 'err') => backUrl(email, flash, ft);
  if (!nodeId || !leaderEmail) {
    res.redirect(back('Missing required fields', 'err'));
    return;
  }
  const updated = await hierarchyService.updateLeader(nodeId, leaderEmail);
  if (!updated) {
    res.redirect(back('Node not found', 'err'));
    return;
  }
  res.redirect(back('Leader updated successfully', 'ok'));
});

// POST /ui/update/name
router.post('/update/name', requireUiAuth, async (req: Request, res: Response) => {
  const { nodeId, name, email } = req.body as {
    nodeId?: string;
    name?: string;
    email?: string;
  };
  const back = (flash: string, ft: 'ok' | 'err') => backUrl(email, flash, ft);
  if (!nodeId || !name || !name.trim()) {
    res.redirect(back('Missing required fields', 'err'));
    return;
  }
  const updated = await hierarchyService.updateNodeName(nodeId, name.trim());
  if (!updated) {
    res.redirect(back('Node not found', 'err'));
    return;
  }
  res.redirect(back('Node renamed successfully', 'ok'));
});

// POST /ui/update/member
router.post('/update/member', requireUiAuth, async (req: Request, res: Response) => {
  const { email, newNodeId } = req.body as {
    email?: string;
    newNodeId?: string;
  };
  const back = (flash: string, ft: 'ok' | 'err') => backUrl(email, flash, ft);
  if (!email || !newNodeId) {
    res.redirect(back('Missing required fields', 'err'));
    return;
  }
  // Always look up the current member node from DB to avoid stale hidden-field values
  const currentNode = await hierarchyService.getUserMemberNode(email);
  if (currentNode && currentNode.id !== newNodeId) {
    await hierarchyService.removeMemberFromNode(currentNode.id, email);
  }
  if (!currentNode || currentNode.id !== newNodeId) {
    const added = await hierarchyService.addMemberToNode(newNodeId, email);
    if (!added) {
      res.redirect(back('Target node not found or user already a member', 'err'));
      return;
    }
  }
  res.redirect(back('User reassigned successfully', 'ok'));
});

export default router;
