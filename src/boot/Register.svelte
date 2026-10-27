<script lang="ts">
  import { session, enterDesktop } from '../lib/session.svelte';
  import { backend, AuthError, type Character } from '../lib/backend';
  import { RACE_GROUPS, RACES, CLASSES, BACKGROUNDS, CHROME_TIERS, FACTIONS, SYSTEMS, checkCombo } from '../lib/data/character';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';

  const STEPS = ['Kimlik', 'Köken', 'Sınıf', 'Hikâye', 'Hesap'];
  let step = $state(0), busy = $state(false), err = $state('');
  let avatar = $state(''), file: File | null = $state(null);
  const c = $state<Character>({ name: '', age: '', race: '', origin: '', faction: 'none', clan: '', job: '', cls: '', sub: '', cls2: '', sub2: '',
    level: 1, background: '', chrome: '0', visibleChrome: false, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, bio: '' });
  let username = $state(''), pw = $state(''), pw2 = $state('');

  const cls = $derived(CLASSES.find((x) => x.id === c.cls));
  const cls2 = $derived(CLASSES.find((x) => x.id === c.cls2));
  const race = $derived(RACES.find((x) => x.id === c.race));
  const rules = $derived([...checkCombo(c.race, c.cls, c.sub, c.background), ...(c.cls2 ? checkCombo(c.race, c.cls2, c.sub2, c.background) : [])]);
  const blocked = $derived(rules.some((r) => r.level === 'block'));

  function valid(s: number): string {
    if (s === 0 && (!c.name.trim() || !c.age.trim())) return 'Karakter adı ve yaşı gerekli.';
    if (s === 1 && (!c.race || !c.origin)) return 'Irk ve doğduğu yer gerekli.';
    if (s === 2) { if (!c.cls || !c.background) return 'Sınıf ve geçmiş gerekli.'; if (blocked) return 'Seçilen birleşim kurallara aykırı.';
      if (c.level >= 3 && !c.sub) return '3. seviye ve üstünde dal seçilmeli.'; if (c.cls2 && c.level < 6) return 'İkinci sınıf için ilk sınıf en az 5. seviye olmalı.';
      if (c.cls2 && c.cls2 === c.cls) return 'İkinci sınıf farklı olmalı.'; }
    if (s === 4) { if (!/^[a-z0-9][a-z0-9._-]{2,23}$/i.test(username)) return 'Kullanıcı adı 3–24 karakter: harf, rakam, . _ -';
      if (pw.length < 8) return 'Şifre en az 8 karakter olmalı.'; if (pw !== pw2) return 'Şifreler aynı değil.'; }
    return '';
  }
  function next() { err = valid(step); if (err) { sfx.error(); return; } sfx.click(); step++; }
  function back() { err = ''; sfx.click(); if (step === 0) session.stage = 'login'; else step--; }

  async function pickAvatar(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const img = await createImageBitmap(f); const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
    cv.getContext('2d')!.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
    avatar = cv.toDataURL('image/webp', 0.85); sfx.granted();
  }
  function pickFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null; err = '';
    if (f && !/\.(pdf|docx?)$/i.test(f.name)) { err = 'Yalnız PDF ya da Word dosyası.'; file = null; return; }
    if (f && f.size > 5 * 1024 * 1024) { err = 'Dosya en fazla 5 MB olabilir.'; file = null; return; }
    file = f;
  }
  async function submit() {
    err = valid(4); if (err) { sfx.error(); return; }
    busy = true;
    try {
      const u = await backend.register(username, pw, avatar || defaultAvatar(), $state.snapshot(c) as Character, file);
      sfx.granted(); enterDesktop(u);
    } catch (x) { sfx.error(); err = x instanceof AuthError ? x.message : 'Kayıt başarısız: ' + (x as Error).message; busy = false; }
  }
  function defaultAvatar() {
    const ch = (c.name.trim()[0] || '?').toUpperCase();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0e17"/><path d="M50 6 90 28v44L50 94 10 72V28z" fill="none" stroke="#00f0ff" stroke-width="3"/><text x="50" y="64" font-family="monospace" font-size="42" text-anchor="middle" fill="#fcee0a">${ch}</text></svg>`);
  }
  const fmt = (n: number) => (n / 1024 / 1024).toFixed(2) + ' MB';
</script>

<div class="wrap">
  <Backdrop dim={0.6} />
  <div class="panel">
    <header>
      <div><div class="k mono">YENİ KAYIT · KÜME NÜFUS KÜTÜĞÜ</div><h1>Karakter oluştur</h1></div>
      <ol class="steps">{#each STEPS as s, i}<li class:on={i === step} class:done={i < step}><b>{String(i + 1).padStart(2, '0')}</b>{s}</li>{/each}</ol>
    </header>

    <section class="body">
      {#if step === 0}
        <div class="g2">
          <div class="av">
            <label class="avbox clickable">
              {#if avatar}<img src={avatar} alt="" />{:else}<span class="mono">PROFİL<br />RESMİ</span>{/if}
              <input type="file" accept="image/*" onchange={pickAvatar} hidden />
            </label>
            <div class="mono note">Tıkla, resim seç. 256 px'e küçültülür.</div>
          </div>
          <div class="col">
            <label class="field"><span>Karakter adı *</span><input class="inp" bind:value={c.name} maxlength="60" /></label>
            <label class="field"><span>Yaş *</span><input class="inp" bind:value={c.age} maxlength="12" placeholder="örn. 34" /></label>
            <label class="field"><span>Meslek</span><input class="inp" bind:value={c.job} maxlength="60" placeholder="örn. hurda pilotu, kâtip, madenci" /></label>
          </div>
        </div>
      {:else if step === 1}
        <div class="g2">
          <label class="field"><span>Irk *</span>
            <select class="inp" bind:value={c.race}><option value="" disabled>— seç —</option>
              {#each RACE_GROUPS as g}<optgroup label={g.group}>{#each g.races as r}<option value={r.id}>{r.label} · {r.hint}</option>{/each}</optgroup>{/each}
            </select></label>
          <label class="field"><span>Doğduğu sistem *</span>
            <select class="inp" bind:value={c.origin}><option value="" disabled>— seç —</option>{#each SYSTEMS as s}<option>{s}</option>{/each}</select></label>
          <label class="field"><span>Bağlı olduğu devlet / kurum</span>
            <select class="inp" bind:value={c.faction}>{#each FACTIONS as f}<option value={f.id}>{f.label}</option>{/each}</select></label>
          <label class="field"><span>Klan · hane · kabile · aile</span><input class="inp" bind:value={c.clan} maxlength="60" placeholder="örn. Taşboğaz Klanı, Ostergaard Hanesi" /></label>
        </div>
        {#if race}<div class="info mono">BASE HP <b>{race.hp}</b> · yatkınlık: {race.hint}</div>{/if}
      {:else if step === 2}
        <div class="g2">
          <label class="field"><span>Sınıf *</span>
            <select class="inp" bind:value={c.cls} onchange={() => (c.sub = '')}><option value="" disabled>— seç —</option>{#each CLASSES as k}<option value={k.id}>{k.label} · {k.stat}</option>{/each}</select></label>
          <label class="field"><span>Dal (3. seviyede)</span>
            <select class="inp" bind:value={c.sub} disabled={!cls}><option value="">— henüz yok —</option>{#each cls?.subs ?? [] as s}<option value={s.id}>{s.label}</option>{/each}</select></label>
          <label class="field"><span>Seviye</span><input class="inp" type="number" min="1" max="20" bind:value={c.level} /></label>
          <label class="field"><span>Geçmiş *</span>
            <select class="inp" bind:value={c.background}><option value="" disabled>— seç —</option>{#each BACKGROUNDS as b}<option value={b.id}>{b.label}</option>{/each}</select></label>
          <label class="field"><span>İkinci sınıf (opsiyonel)</span>
            <select class="inp" bind:value={c.cls2} onchange={() => (c.sub2 = '')}><option value="">— yok —</option>{#each CLASSES as k}<option value={k.id}>{k.label}</option>{/each}</select></label>
          <label class="field"><span>İkinci sınıf dalı</span>
            <select class="inp" bind:value={c.sub2} disabled={!cls2}><option value="">— yok —</option>{#each cls2?.subs ?? [] as s}<option value={s.id}>{s.label}</option>{/each}</select></label>
          <label class="field"><span>Krom işlemcisi</span>
            <select class="inp" bind:value={c.chrome}>{#each CHROME_TIERS as t}<option value={t.id}>{t.label}</option>{/each}</select></label>
          <label class="chk clickable"><input type="checkbox" bind:checked={c.visibleChrome} /> <span>Görünür kromu var</span></label>
        </div>
        {#if c.background}<div class="info mono">{BACKGROUNDS.find((b) => b.id === c.background)?.hint}</div>{/if}
        <div class="stats">{#each Object.keys(c.stats) as s}<label class="field"><span>{s}</span><input class="inp" type="number" min="1" max="30" bind:value={c.stats[s]} /></label>{/each}</div>
        {#each rules as r}<div class={'rule mono ' + r.level}>{r.level === 'block' ? '✖' : '⚠'} {r.text}</div>{/each}
      {:else if step === 3}
        <label class="field"><span>Kısa tanıtım / görünüş / kişilik</span><textarea class="inp" rows="6" bind:value={c.bio} maxlength="3000"></textarea></label>
        <label class="drop clickable">
          <input type="file" accept=".pdf,.doc,.docx" onchange={pickFile} hidden />
          {#if file}<b>{file.name}</b><span class="mono">{fmt(file.size)} · değiştirmek için tıkla</span>
          {:else}<b>Background hikâyesi yükle</b><span class="mono">PDF ya da Word · en fazla 5 MB · opsiyonel</span>{/if}
        </label>
      {:else}
        <div class="g2">
          <label class="field"><span>Kullanıcı adı *</span><input class="inp" bind:value={username} autocomplete="username" spellcheck="false" /></label>
          <div></div>
          <label class="field"><span>Şifre *</span><input class="inp" type="password" bind:value={pw} autocomplete="new-password" /></label>
          <label class="field"><span>Şifre tekrar *</span><input class="inp" type="password" bind:value={pw2} autocomplete="new-password" /></label>
        </div>
        <div class="sum">
          <img src={avatar || defaultAvatar()} alt="" />
          <div class="mono"><b>{c.name}</b> · {c.age} yaş · {race?.label}<br />{cls?.label}{c.sub ? ' / ' + cls?.subs.find((s) => s.id === c.sub)?.label : ''} · Sv {c.level}{cls2 ? ' + ' + cls2.label : ''}<br />
            {BACKGROUNDS.find((b) => b.id === c.background)?.label} · {c.origin}{c.clan ? ' · ' + c.clan : ''}<br />{file ? '📎 ' + file.name : 'dosya yok'}</div>
        </div>
      {/if}
      {#if err}<div class="err mono">⚠ {err}</div>{/if}
    </section>

    <footer>
      <button class="btn ghost" onclick={back}>{step === 0 ? 'Girişe dön' : 'Geri'}</button>
      {#if step < 4}<button class="btn" onclick={next}>İleri</button>
      {:else}<button class="btn" onclick={submit} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Hesabı aç'}</button>{/if}
    </footer>
  </div>
</div>

<style>
  .wrap{position:absolute;inset:0;display:grid;place-items:center}
  .panel{position:relative;width:min(900px,94vw);max-height:92vh;display:flex;flex-direction:column;background:var(--panel);backdrop-filter:blur(10px);
    border:1px solid var(--line);clip-path:polygon(0 0,calc(100% - 30px) 0,100% 30px,100% 100%,30px 100%,0 calc(100% - 30px));animation:pin .5s cubic-bezier(.2,.9,.2,1) both}
  .panel::before{content:"";position:absolute;left:0;top:0;height:3px;width:30%;background:var(--ye);box-shadow:0 0 12px var(--ye)}
  @keyframes pin{0%{opacity:0;transform:scaleY(.02)}40%{opacity:1;transform:scaleY(.02)}100%{transform:none}}
  header{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:24px 30px 16px;border-bottom:1px solid var(--line)}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--mut)}
  h1{font-family:var(--f-disp);font-size:24px;letter-spacing:.14em;color:var(--tx);margin-top:4px}
  .steps{display:flex;gap:4px;list-style:none}
  .steps li{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding:6px 10px;border-bottom:2px solid rgba(255,255,255,.08)}
  .steps li b{font-family:var(--f-mono);margin-right:6px;color:inherit}
  .steps li.done{color:var(--cy);border-color:var(--cy)}.steps li.on{color:var(--ye);border-color:var(--ye)}
  .body{padding:22px 30px;overflow:auto;display:flex;flex-direction:column;gap:16px;animation:sw .3s both}
  @keyframes sw{from{opacity:0;transform:translateX(12px)}}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px}
  .col{display:flex;flex-direction:column;gap:16px}
  .av{display:flex;flex-direction:column;align-items:center;gap:10px}
  .avbox{width:170px;height:170px;display:grid;place-items:center;text-align:center;color:var(--cy);font-size:12px;letter-spacing:.2em;
    border:1px dashed var(--cy);background:rgba(0,240,255,.04);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);transition:background .2s}
  .avbox:hover{background:rgba(0,240,255,.12)}
  .avbox img{width:100%;height:100%;object-fit:cover}
  .note{font-size:11px;color:var(--mut)}
  .info{font-size:12.5px;color:var(--cy);border-left:2px solid var(--cy);padding:6px 10px;background:rgba(0,240,255,.05)}
  .info b{color:var(--ye)}
  .stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
  .chk{display:flex;align-items:center;gap:10px;align-self:end;padding-bottom:10px;font-size:14px}
  .chk input{accent-color:var(--ye);width:16px;height:16px}
  .rule{font-size:12.5px;padding:6px 10px}
  .rule.warn{color:var(--ye);background:rgba(252,238,10,.06);border-left:2px solid var(--ye)}
  .rule.block{color:var(--rd);background:rgba(255,42,85,.08);border-left:2px solid var(--rd)}
  textarea.inp{resize:vertical;font-family:var(--f-ui);font-size:15px}
  .drop{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px;border:1px dashed var(--cy);background:rgba(0,240,255,.03);transition:background .2s}
  .drop:hover{background:rgba(0,240,255,.09)}.drop b{color:var(--ye);letter-spacing:.1em}.drop span{font-size:12px;color:var(--mut)}
  .sum{display:flex;gap:18px;align-items:center;padding:14px;border:1px solid var(--line);background:rgba(0,0,0,.25)}
  .sum img{width:72px;height:72px;object-fit:cover;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
  .sum div{font-size:13px;line-height:1.6;color:var(--mut)}.sum b{color:var(--ye)}
  .err{color:var(--rd);font-size:13px;border-left:2px solid var(--rd);padding:6px 10px;background:rgba(255,42,85,.08)}
  footer{display:flex;justify-content:space-between;padding:16px 30px 22px;border-top:1px solid var(--line)}
</style>
