const TERMS = [
  ['RBT certification', /rbt (certif|credential)|registered behavior technician certif|bacb/, true],
  ['40-hour RBT training', /40[- ]hour/, true],
  ['Competency assessment', /competency assessment/, true],
  ['Level 2 background screening', /level ?2|background (check|screen)/, false],
  ['CPR / First Aid', /\bcpr\b|first aid/, false],
  ["Driver's license / transportation", /driver.?s? licen|reliable transportation|own vehicle|valid dl/, true],
  ['Data collection', /data collection|collect(ing)? data|collect and record/, true],
  ['Behavior intervention plans', /behavior (intervention|support|reduction) plan|\bbip\b|treatment plan/, true],
  ['Skill acquisition', /skill[- ]acquisition/, true],
  ['Caregiver / parent training', /parent(al)? training|caregiver training|family training/, false],
  ['DTT', /\bdtt\b|discrete trial/, true],
  ['NET', /\bnet\b|natural environment/, true],
  ['Verbal behavior / VB-MAPP', /verbal behavior|vb-?mapp/, false],
  ['Catalyst', /catalyst/, false],
  ['CentralReach', /central ?reach/, false],
  ['HIPAA', /hipaa/, true],
  ['Medicaid', /medicaid/, true],
  ['Bilingual Spanish', /bilingual|spanish/, true],
  ['Autism / ASD experience', /autism|\basd\b/, true],
  ['BCBA supervision', /bcba/, true],
  ['Session notes / documentation', /session notes|documentation|progress notes/, true],
  ['Reinforcement / prompting', /reinforcement|prompting|prompt/, true],
  ['Crisis / safety / de-escalation', /crisis|safety[- ]care|de-?escalat|\bcpi\b/, true],
  ["Bachelor's degree", /bachelor/, true],
  ['Psychology background', /psychology/, true],
  ['Experience with children', /experience (working )?with children|children with/, true],
  ['Developmental disabilities', /developmental disabilit/, true],
  ['Microsoft Office / technology', /microsoft|excel|technology skills|computer skills/, true],
  ['Adolescents / teens', /adolescen|teen/, false],
  ['Adults', /\badults?\b/, false],
  ['Group / classroom', /classroom|group setting/, false],
  ['Toilet / feeding programs', /toilet|feeding/, false],
  ['Lead / senior technician role', /\blead (rbt|behavior|technician)|\bsenior (rbt|behavior)/, false],
]

const VARIANT = (j) => (j.setting.includes('school') ? 'school' : j.setting.includes('clinic') && !j.setting.includes('in-home') ? 'clinic' : j.setting.includes('in-home') ? 'inhome' : 'master')
const VARIANT_LABEL = { school: 'School-based', clinic: 'Clinic', inhome: 'In-home', master: 'Master' }

export function matchResume(job, description = '') {
  const t = `${job.title}\n${description}`.toLowerCase()
  const asked = TERMS.filter(([, re]) => re.test(t))
  const covered = asked.filter(([, , has]) => has).map(([n]) => n)
  const missing = asked.filter(([, , has]) => !has).map(([n]) => n)
  const pct = asked.length ? Math.round((100 * covered.length) / asked.length) : null
  const v = VARIANT(job)
  return { pct, covered, missing, variant: v, variantLabel: VARIANT_LABEL[v] }
}
