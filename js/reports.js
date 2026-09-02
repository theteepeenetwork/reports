/* reports.js — report builder — comment banks, prompts, drag-and-drop board
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */


    const banks = {
      literacyLevel: { label: 'Literacy level', options: ['below', 'meeting', 'exceeding'] },
      sentenceStructure: { label: 'Literacy - writing - sentence structure', options: [
        'produces writing that is becoming neat and clear',
        'can join parts of sentences using conjunctions such as and, but, or and because',
        'uses interesting vocabulary to make writing more engaging and exciting',
        'is attempting to write sentences independently and recognises the structure of a sentence',
        'is improving sentence structure and is beginning to extend ideas with more confidence',
        'can compose short sentences with support and is beginning to add more detail'
      ] },
      handwriting: { label: 'Literacy - writing - handwriting', options: [
        'has made outstanding progress with handwriting and is joining with correct formation and spacing',
        'has made good progress with handwriting and is using correct formation more consistently',
        'forms letters carefully and should be proud of how far handwriting has come',
        'has made great progress with letter formation and knows how to join writing, although consistency is still developing',
        'is developing neat presentation but needs to check the size and spacing of writing',
        'has worked hard to improve handwriting and should now focus on maintaining this quality in all pieces of work'
      ] },
      punctuation: { label: 'Literacy - writing - punctuation', options: [
        'understands how to correctly use capital letters and full stops',
        'is beginning to use capital letters and full stops more consistently',
        'can use punctuation accurately when reminded to check work carefully',
        'recognises the structure of a sentence but sometimes needs support to add capital letters and full stops',
        'writes letters and numbers of the correct size with appropriate spacing',
        'is developing greater accuracy with punctuation and presentation'
      ] },
      spelling: { label: 'Literacy - writing - spelling', options: [
        'has made good improvements in spelling through Sounds-Write and is more frequently making the correct choice when spelling words',
        'has made excellent improvements in spelling and often applies the correct spelling choices independently',
        'finds spelling challenging but has made encouraging progress this year',
        'is making plausible attempts at spelling familiar words',
        'sometimes finds it difficult to recall familiar spelling patterns and will benefit from continued practice',
        'is beginning to apply Sounds-Write strategies more confidently in independent writing'
      ] },
      phonics: { label: 'Literacy - reading - phonics', options: [
        'has made excellent progress in Sounds-Write and is reading words with greater complexity',
        'has made good progress in Sounds-Write and is reading increasingly complex words with growing confidence',
        'has made encouraging progress in Sounds-Write and is using sounds with growing confidence to decode words',
        'is still consolidating the Initial Code but joins in with Extended Code lessons too',
        'recalls phonics sounds confidently and blends with increasing accuracy',
        'is recognising more sounds and beginning to blend words more accurately'
      ] },
      fluency: { label: 'Literacy - reading - fluency', options: [
        'reads most Year 2 books at a steady pace, pausing for full stops and commas so the story makes sense',
        'blends new words quickly and usually fixes slip-ups straight away, keeping reading steady and easy to follow',
        'reads with fluency and confidence, recognising punctuation and adding intonation',
        'has made excellent progress with reading and is reading words with more confidence and at a higher pace',
        'is still reliant on blending unfamiliar words, which can break the flow of reading',
        'is beginning to use expression and punctuation to show feeling and meaning'
      ] },
      comprehension: { label: 'Literacy - reading - comprehension', options: [
        'shows a good understanding of what has been read',
        'can explain characters’ feelings and motives and is beginning to use evidence from the text',
        'answers questions about texts with increasing confidence and detail',
        'sometimes needs support to understand and explain what has been read',
        'is developing comprehension skills through discussion and adult support',
        'can talk about key events and characters in familiar texts'
      ] },
      literacyNotable: { label: 'Literacy - notable', options: [
        'has made excellent progress and should be proud of these achievements',
        'has shown resilience with reading and writing tasks that can feel challenging',
        'is becoming more independent and willing to have a go in literacy',
        'takes pride in written work and responds well to feedback',
        'is developing confidence when sharing written ideas',
        'would benefit from continuing to check work carefully for spelling, punctuation and presentation'
      ] },
      numeracyLevel: { label: 'Numeracy', options: ['below', 'meeting', 'exceeding'] },
      mentalStarter: { label: 'Mental starter', options: [
        'tries hard with mental starters but often needs support with the questions',
        'is beginning to recall previously taught concepts but lacks fluency and confidence',
        'can complete morning revision tasks with growing confidence and independence',
        'recalls a range of previously taught concepts and applies them accurately',
        'shows secure understanding of key mathematical ideas during mental starters',
        'completes mental starter tasks efficiently, demonstrating excellent recall of learning'
      ] },
      number: { label: 'Numeracy - number', options: [
        'struggles to understand place value and often confuses tens and ones',
        'needs support to read, write and compare numbers up to 100',
        'is beginning to count in 2s, 5s and 10s but requires frequent reminders',
        'can confidently read, write and order numbers to 100',
        'understands the value of digits in two-digit numbers and uses this to solve problems',
        'works confidently with numbers beyond 100 and explains place value clearly'
      ] },
      calculation: { label: 'Numeracy - calculation', options: [
        'finds it difficult to choose and use appropriate strategies for calculations',
        'struggles with written methods and often needs adult guidance to complete tasks',
        'has an emerging understanding of the four operations but lacks fluency',
        'can add and subtract two-digit numbers using mental and written methods',
        'is developing confidence using arrays and repeated addition for multiplication',
        'uses appropriate strategies for all four operations and explains reasoning'
      ] },
      numberFacts: { label: 'Numeracy - number facts', options: [
        'struggles to recall basic multiplication facts and often needs support',
        'is beginning to learn the 2, 5 and 10 times tables but lacks fluency',
        'relies on concrete resources or counting to work out multiplication facts',
        'can recall and use the 2, 5 and 10 times tables with growing accuracy',
        'applies known number facts to solve simple multiplication and division problems',
        'demonstrates confidence and developing fluency with key times tables'
      ] },
      numeracyGeneral: { label: 'Numeracy - general', options: [
        'works hard in maths and is beginning to show more independence when completing tasks',
        'shows determination even when mathematical tasks are challenging',
        'is developing confidence with number, calculation and reasoning',
        'sometimes needs adult support to explain thinking and choose efficient methods',
        'has made good progress and is beginning to apply learning across different contexts',
        'shows secure understanding and can explain mathematical thinking clearly'
      ] },
      attitude: { label: 'General - Attitude to Learning', options: [
        'approaches every learning opportunity with enthusiasm and consistently gives their very best',
        'works hard in lessons and is developing greater perseverance',
        'tries their best with encouragement and is beginning to take more ownership of learning',
        'sometimes becomes distracted and benefits from support to remain focused',
        'is a highly motivated learner who approaches tasks with enthusiasm and pride',
        'shows a determined attitude and tackles new challenges with resilience'
      ] },
      enthusiasm: { label: 'General - Enthusiasm for Learning', options: [
        'brings great energy and curiosity to every lesson',
        'shows consistent interest in learning and enjoys discovering new ideas',
        'is usually positive about learning but sometimes needs gentle encouragement',
        'can find it difficult to engage in some activities but is beginning to show more interest',
        'enjoys learning and takes pride in progress',
        'approaches school life with a positive and respectful attitude'
      ] },
      sharing: { label: 'General - Sharing Knowledge and Interests', options: [
        'enthusiastically shares wide knowledge and interests with peers and adults',
        'often contributes own ideas and experiences to class discussions',
        'enjoys sharing interesting facts and knowledge with the class',
        'is becoming more confident in offering ideas and is keen to contribute',
        'sometimes needs encouragement to speak up and share what they know',
        'is beginning to take more risks when sharing ideas'
      ] },
      communication: { label: 'General - Communication with Adults', options: [
        'communicates clearly and thoughtfully with adults, showing maturity and respect',
        'speaks confidently and politely with adults around school',
        'enjoys chatting with adults and often shares stories and ideas',
        'responds well to adults and is developing confidence in conversations',
        'can be reserved when talking to adults but is gradually becoming more assured',
        'listens carefully to adults and responds positively to guidance'
      ] },
      teamwork: { label: 'General - Teamwork and Cooperation', options: [
        'thrives in group tasks and consistently demonstrates leadership and cooperation',
        'works exceptionally well in a team and encourages others to succeed',
        'is a supportive team member who listens carefully and takes turns',
        'can work with others and is learning to share ideas more effectively',
        'sometimes finds teamwork challenging and is learning to compromise',
        'plays an active part in group activities when supported and encouraged'
      ] },
      relationships: { label: 'General - Relationships with Peers', options: [
        'builds positive relationships with others and is a role model for inclusive play',
        'has made strong friendships and is a kind and caring friend',
        'enjoys socialising and plays cooperatively with a wide range of peers',
        'is developing confidence in friendships and enjoys spending time with familiar friends',
        'sometimes needs support with sharing and resolving small disagreements',
        'is a kind and supportive friend who plays cooperatively with others'
      ] },
      clubs: { label: 'General - Engagement in Extra-Curricular Clubs', options: [
        'has enjoyed taking part in after-school clubs throughout the year',
        'has participated enthusiastically in extra-curricular activities',
        'has grown in confidence through taking part in clubs and wider school opportunities',
        'has enjoyed joining in with activities beyond the classroom',
        'has shown commitment and enthusiasm when attending clubs',
        'no club comment needed'
      ] },
      confidence: { label: 'General - Self-Confidence', options: [
        'has blossomed in confidence and now approaches challenges with a positive mindset',
        'is a confident learner who enjoys speaking and sharing ideas',
        'is becoming more self-assured and is beginning to take more risks in learning',
        'shows confidence in familiar situations and is building it in new ones',
        'can be hesitant in new situations but is making steady progress',
        'has grown in confidence and independence throughout the year'
      ] },
      behaviour: { label: 'General - Behaviour and Conduct', options: [
        'consistently demonstrates excellent behaviour and is a positive role model',
        'consistently behaves in a mature manner, showing kindness and respect to everyone',
        'follows class rules well and responds positively to reminders when needed',
        'usually behaves appropriately and is developing greater self-control',
        'occasionally needs reminders to stay focused and make the right choices',
        'is polite, respectful and contributes positively to the classroom'
      ] },
      furtherBehaviour: { label: 'Further behaviour notes', options: [
        'is full of energy and brings a positive presence to the classroom',
        'has a cheerful attitude and a growing confidence that make them a valued member of the class',
        'benefits from clear routines, calm reminders and positive reinforcement',
        'is learning to manage emotions and respond to support when situations feel challenging',
        'has made pleasing progress with independence and classroom routines',
        'no further behaviour note needed'
      ] }
    };

    const order = [
      'literacyLevel', 'sentenceStructure', 'handwriting', 'punctuation', 'spelling',
      'phonics', 'fluency', 'comprehension', 'literacyNotable', 'numeracyLevel',
      'mentalStarter', 'number', 'calculation', 'numberFacts', 'numeracyGeneral',
      'attitude', 'enthusiasm', 'sharing', 'communication', 'teamwork',
      'relationships', 'clubs', 'confidence', 'behaviour', 'furtherBehaviour'
    ];

    /* ===================================================================
       Comments are stored per pupil, keyed by the shared Class List id,
       in tp_report_sel ({ pupilId: { field: value } }). Names always come
       from sortedRoster() — there is no separate child list on this page.
       =================================================================== */
    const REPORT_SEL_KEY = 'tp_report_sel';
    /* tp_report_sel + reportBuilderChildren are per-class — go through Store
       (class-aware) rather than raw localStorage, so they don't bleed classes. */
    let reportSel = Store.get(REPORT_SEL_KEY, {}) || {};

    /* one-time migration: carry over comments sorted under the old name-keyed builder */
    (function migrateReportSel() {
      if (reportSel && Object.keys(reportSel).length) return;
      let legacy = Store.get('reportBuilderChildren', []);
      if (!Array.isArray(legacy) || !legacy.length) return;
      const byName = {};
      sortedRoster().forEach((p) => { byName[String(p.name).trim().toLowerCase()] = p.id; });
      legacy.forEach((c) => {
        const id = byName[String(c && c.name || '').trim().toLowerCase()];
        if (id && c.selections) reportSel[id] = Object.assign({}, c.selections);
      });
      if (Object.keys(reportSel).length) Store.set(REPORT_SEL_KEY, reportSel);
    })();

    function rsPersist() { Store.set(REPORT_SEL_KEY, reportSel); }
    function rsFor(pid) { if (!reportSel[pid]) reportSel[pid] = {}; return reportSel[pid]; }
    function rsVal(pid, field) { const s = reportSel[pid]; return (s && s[field]) || ''; }

    function getPronouns(gender) {
      if (gender === 'female') return { pronoun: 'she', possessive: 'her' };
      if (gender === 'male') return { pronoun: 'he', possessive: 'his' };
      return { pronoun: 'they', possessive: 'their' };
    }

    function tokenise(text, pupil) {
      const p = getPronouns(pupil.pronouns);
      return String(text)
        .replaceAll('{name}', pupil.name)
        .replaceAll('{pronoun}', p.pronoun)
        .replaceAll('{possessive}', p.possessive);
    }

    function buildPromptForPupil(pupil) {
      const pr = getPronouns(pupil.pronouns);
      const sel = reportSel[pupil.id] || {};
      const lines = [`Child: ${pupil.name}`, `Pronouns: ${pr.pronoun}/${pr.possessive}`, ''];
      order.forEach((key) => {
        const val = sel[key];
        if (val && !val.toLowerCase().startsWith('no ')) {
          lines.push(`${banks[key].label}: ${tokenise(val, pupil)}`);
        }
      });
      const comments = lines.join('\n');
      const literacyLevel = sel.literacyLevel || 'meeting';
      const numeracyLevel = sel.numeracyLevel || 'meeting';
      const prompt = `${comments}\n\nUsing only the comments above, write an individual end-of-year report for this Year 2 child.\n\nRules:\n- Do not invent extra information.\n- Use UK spelling and grammar.\n- Write in the third person.\n- Exactly three paragraphs, each under 100 words.\n- Paragraph 1 must begin: "${pupil.name} is ${literacyLevel} age-related expectation in literacy." Cover reading fluency and comprehension, handwriting, spelling and composition. Praise first, next steps second.\n- Paragraph 2 must begin: "${pupil.name} is ${numeracyLevel} age-related expectation in numeracy." Cover number sense, calculation, reasoning and recall speed. Praise first, next steps second.\n- Paragraph 3 must begin: "${pupil.name} has had a wonderful year this year and enjoyed many aspects of Year 2." Summarise attitude, behaviour, friendships, confidence and clubs only where mentioned. End with a forward-looking sentence about Year 3.\n- Keep the tone warm, professional, encouraging and conversational.`;
      return { comments, prompt };
    }

    function buildAllPrompts() {
      return sortedRoster()
        .map((pupil, index) => `==============================\n${index + 1}. ${pupil.name}\n==============================\n\n${buildPromptForPupil(pupil).prompt}`)
        .join('\n\n');
    }

    function generateAllPrompts() {
      const out = document.getElementById('promptOutput');
      if (!out) return;
      if (!sortedRoster().length) { out.value = 'Add pupils on the Class List page first.'; return; }
      out.value = buildAllPrompts();
    }

    function downloadAllPrompts() {
      if (!sortedRoster().length) { alert('Add pupils on the Class List page first.'); return; }
      const blob = new Blob([buildAllPrompts()], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'year-2-report-prompts-all.txt'; a.click();
      URL.revokeObjectURL(url);
    }

    function copyAllPrompts() {
      if (!sortedRoster().length) { alert('Add pupils on the Class List page first.'); return; }
      navigator.clipboard.writeText(buildAllPrompts());
      alert('All prompts copied.');
    }

    /* ===================================================================
       GROUP CHILDREN BY COMMENT — drag-and-drop board (PR #1)
       Drag a child's chip into a column to set that comment for them.
       =================================================================== */
    function columnsForField(field) {
      const bank = banks[field];
      const cols = [{ value: '', label: 'Not set yet' }];
      if (bank) bank.options.forEach((o) => cols.push({ value: o, label: o }));
      return cols;
    }
    function initBoard() {
      const sel = document.getElementById('boardField');
      if (!sel) return;
      sel.innerHTML = order.map((k) => `<option value="${k}">${banks[k].label}</option>`).join('');
      sel.value = banks.handwriting ? 'handwriting' : order[0];
      sel.onchange = renderBoard;
    }

    function renderBoard() {
      const board = document.getElementById('rbBoard');
      const sel = document.getElementById('boardField');
      if (!board || !sel) return;
      if (!sel.options.length) initBoard();
      const field = sel.value || order[0];
      const pupils = sortedRoster();
      if (!pupils.length) { board.innerHTML = '<p class="hint small">Add pupils on the <b>Class List</b> page to start grouping them by comment.</p>'; return; }
      board.innerHTML = columnsForField(field).map((col) => {
        const members = pupils.filter((p) => rsVal(p.id, field) === col.value);
        const chips = members.map((p) =>
          `<div class="rb-chip" data-pid="${p.id}" onpointerdown="rbDragStart(event,'${p.id}')">${esc(p.name)}</div>`
        ).join('');
        return `<div class="rb-col${col.value === '' ? ' notset' : ''}" data-val="${esc(col.value)}">` +
          `<div class="rb-col-head"><span class="rb-col-title">${esc(col.label)}</span><span class="rb-col-count">${members.length}</span></div>` +
          `<div class="rb-col-body">${chips || '<span class="rb-col-empty">—</span>'}</div>` +
        '</div>';
      }).join('');
    }

    function reportsRender() { renderBoard(); }

    /* drag + snap via pointer events (mouse + touch) */
    let rbDrag = null;
    function rbColAt(e) {
      let found = null;
      document.querySelectorAll('#rbBoard .rb-col').forEach((c) => {
        const r = c.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) found = c;
      });
      return found;
    }
    function rbDragStart(e, pid) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const src = e.currentTarget, rect = src.getBoundingClientRect();
      const ghost = src.cloneNode(true);
      ghost.classList.add('rb-ghost');
      ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:9999;pointer-events:none;margin:0;`;
      document.body.appendChild(ghost);
      src.classList.add('dragging');
      rbDrag = { pid, ghost, src, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
      window.addEventListener('pointermove', rbDragMove);
      window.addEventListener('pointerup', rbDragEnd);
    }
    function rbDragMove(e) {
      if (!rbDrag) return;
      rbDrag.moved = true;
      rbDrag.ghost.style.left = (e.clientX - rbDrag.dx) + 'px';
      rbDrag.ghost.style.top = (e.clientY - rbDrag.dy) + 'px';
      const col = rbColAt(e);
      document.querySelectorAll('#rbBoard .rb-col').forEach((c) => c.classList.toggle('drop', c === col));
    }
    function rbDragEnd(e) {
      window.removeEventListener('pointermove', rbDragMove);
      window.removeEventListener('pointerup', rbDragEnd);
      if (!rbDrag) return;
      const d = rbDrag; rbDrag = null;
      if (d.ghost) d.ghost.remove();
      if (d.src) d.src.classList.remove('dragging');
      document.querySelectorAll('#rbBoard .rb-col').forEach((c) => c.classList.remove('drop'));
      if (!d.moved) { return; }   // a tap with no drag — nothing to open
      const col = rbColAt(e);
      if (!col) { renderBoard(); return; }
      const field = document.getElementById('boardField').value;
      rsFor(d.pid)[field] = col.getAttribute('data-val');
      rsPersist();
      renderBoard();
    }

    /* ---- init report board ---- */
    initBoard();
    renderBoard();
