import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Layers3,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PUBLIC_PLAN_CATALOG } from '../lib/entitlements';

const formatPrice = ({ price }) => price === 0 ? '$0' : `$${price}`;

const workflow = [
  {
    number: '01',
    icon: NotebookPen,
    eyebrow: 'BEFORE & AFTER',
    title: 'Keep the full trade story.',
    copy: 'Log your setup, risk, execution, and reflection together, so every result has context.',
    tag: 'Trading Journal',
  },
  {
    number: '02',
    icon: BarChart3,
    eyebrow: 'REVIEW',
    title: 'See what your history shows.',
    copy: 'Compare outcomes by pair, session, setup, and time period with analytics built from your records.',
    tag: 'Performance Analytics',
  },
  {
    number: '03',
    icon: Target,
    eyebrow: 'IMPROVE',
    title: 'Choose a focus for next time.',
    copy: 'Use goals, reflections, and challenges to turn review into a process you can keep following.',
    tag: 'Goals & Reflections',
  },
];

const details = [
  {
    icon: Activity,
    title: 'Performance that has context',
    copy: 'Move beyond a single P&L number. Review win rate, R-multiples, drawdown, and trade patterns across the parts of your process.',
    meta: 'PAIR · SESSION · SETUP',
  },
  {
    icon: ShieldCheck,
    title: 'A journal that keeps your process visible',
    copy: 'Capture trade notes, screenshots, emotions, and lessons so you can revisit the decisions behind each outcome.',
    meta: 'PLAN · EXECUTION · REVIEW',
  },
];

export default function Landing() {
  return (
    <main className="public-landing">
      <header className="landing-nav">
        <Link className="landing-brand" to="/" aria-label="EdgeJournal home">
          <span className="landing-brand-icon"><TrendingUp size={19} /></span>
          EdgeJournal
        </Link>
        <nav aria-label="Main navigation">
          <a href="#workflow">How it works</a>
          <a href="#features">Features</a>
          <a href="#plans">Plans</a>
          <Link className="landing-signin" to="/login">Sign in</Link>
          <Link className="landing-nav-cta" to="/register">Start journaling <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><i /> THE TRADING JOURNAL FOR INTENTIONAL EXECUTION</span>
          <h1>Trade with a plan.<br /><em>Learn from the record.</em></h1>
          <p>Bring your trading journal, performance review, and process goals into one workspace. See what happened, understand the context, and decide what to work on next.</p>
          <div className="landing-hero-actions">
            <Link className="landing-primary" to="/register">Get started free <ArrowRight size={17} /></Link>
            <a className="landing-secondary" href="#workflow">Explore the workflow <ChevronRight size={15} /></a>
          </div>
          <div className="landing-hero-points">
            <span><Check size={14} /> Your own trade history</span>
            <span><Check size={14} /> Plans from $0/month</span>
          </div>
        </div>

        <div className="landing-product-preview" aria-label="Illustrative EdgeJournal performance dashboard preview">
          <div className="landing-preview-windowbar">
            <span className="landing-window-dots"><i /><i /><i /></span>
            <span className="landing-preview-title">EDGEJOURNAL <b>/</b> PERFORMANCE</span>
            <span className="landing-preview-sample">SAMPLE DATA</span>
          </div>
          <div className="landing-preview-heading">
            <div><span>YOUR REVIEW</span><h2>Performance overview</h2></div>
            <span className="landing-preview-period">ALL TIME <ChevronRight size={12} /></span>
          </div>
          <div className="landing-preview-stats">
            <div><span>NET P&amp;L</span><strong>+$642.80</strong><small>Sample result</small></div>
            <div><span>WIN RATE</span><strong>62.5%</strong><small>8 of 13 trades</small></div>
            <div><span>AVERAGE R</span><strong>1.8R</strong><small>Per trade</small></div>
          </div>
          <div className="landing-preview-chart-wrap">
            <div className="landing-preview-chart-label"><span>Equity progression</span><span>Illustrative</span></div>
            <svg className="landing-preview-chart" viewBox="0 0 600 190" role="img" aria-label="Illustrative sample equity chart">
              <defs>
                <linearGradient id="landing-equity-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#56e2c5" stopOpacity=".26" />
                  <stop offset="100%" stopColor="#56e2c5" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 75, 120, 165].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} />)}
              <path className="landing-equity-area" d="M0 148 C34 140 40 118 75 127 S126 113 158 118 S208 91 242 102 S294 78 328 88 S375 57 412 72 S463 43 497 54 S553 21 600 28 L600 190 L0 190Z" />
              <path className="landing-equity-line" d="M0 148 C34 140 40 118 75 127 S126 113 158 118 S208 91 242 102 S294 78 328 88 S375 57 412 72 S463 43 497 54 S553 21 600 28" />
              <circle cx="600" cy="28" r="5" />
            </svg>
            <div className="landing-preview-axis"><span>Trade 01</span><span>Trade 06</span><span>Trade 13</span></div>
          </div>
          <div className="landing-preview-insight">
            <span className="landing-insight-icon"><Sparkles size={15} /></span>
            <div><b>Review the decisions, not just the outcome</b><small>Example preview · Analysis depends on your journal data</small></div>
            <ChevronRight size={15} />
          </div>
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="EdgeJournal workflow">
        <span>ONE WORKSPACE FOR YOUR PROCESS</span>
        <div><b>01</b> LOG THE TRADE</div><i />
        <div><b>02</b> REVIEW THE DATA</div><i />
        <div><b>03</b> REFINE YOUR PLAN</div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="landing-section-heading landing-section-heading-left">
          <span className="landing-eyebrow"><i /> YOUR PROCESS, CONNECTED</span>
          <h2>From the trade you take<br />to the lesson you keep.</h2>
          <p>EdgeJournal helps you make each stage of your trading routine easier to record and review.</p>
        </div>
        <div className="landing-workflow-grid">
          {workflow.map(({ number, icon: Icon, eyebrow, title, copy, tag }) => (
            <article className="landing-workflow-card" key={number}>
              <div className="landing-workflow-card-top"><span>{number}</span><Icon size={19} /></div>
              <small>{eyebrow}</small><h3>{title}</h3><p>{copy}</p>
              <div className="landing-workflow-tag">{tag}<ArrowRight size={13} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-feature-intro">
          <span className="landing-eyebrow"><i /> BUILT FOR BETTER REVIEWS</span>
          <h2>Find the details<br />behind your results.</h2>
          <p>Keep the information you need close, then use your own history to spot the parts of your process worth reviewing.</p>
          <Link className="landing-text-link" to="/register">Start your journal <ArrowRight size={15} /></Link>
        </div>
        <div className="landing-feature-stack">
          {details.map(({ icon: Icon, title, copy, meta }, index) => (
            <article className="landing-detail-card" key={title}>
              <div className="landing-detail-icon"><Icon size={19} /></div>
              <div><span>{meta}</span><h3>{title}</h3><p>{copy}</p></div>
              <b>0{index + 1}</b>
            </article>
          ))}
          <div className="landing-feature-footnote"><ShieldCheck size={15} /> Insights describe your saved trade history. They are not forecasts or financial advice.</div>
        </div>
      </section>

      <section className="landing-plans" id="plans">
        <div className="landing-section-heading">
          <span className="landing-eyebrow"><i /> PLANS THAT GROW WITH YOUR JOURNAL</span>
          <h2>Start with what you need.</h2>
          <p>Compare account, trade, analytics, and review features before choosing a plan.</p>
        </div>
        <div className="landing-plan-grid">
          {PUBLIC_PLAN_CATALOG.map((plan) => (
            <article className={`landing-plan-card${plan.featured ? ' is-featured' : ''}`} key={plan.slug}>
              {plan.featured && <span className="landing-plan-badge">MOST COMPLETE</span>}
              <div className="landing-plan-name">{plan.name}</div>
              <p className="landing-plan-tagline">{plan.tagline}</p>
              <div className="landing-plan-price"><strong>{formatPrice(plan)}</strong><span>/ month</span></div>
              <p className="landing-plan-description">{plan.description}</p>
              <div className="landing-plan-divider" />
              <ul>{plan.highlights.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
              <Link className={plan.featured ? 'landing-plan-action featured' : 'landing-plan-action'} to="/register">
                {plan.price === 0 ? 'Get started free' : 'Choose this plan'} <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
        <p className="landing-plan-note">Prices shown in USD. Paid plan checkout will be available when billing is enabled.</p>
      </section>

      <section className="landing-final-cta">
        <div><span className="landing-eyebrow"><i /> MAKE THE NEXT REVIEW COUNT</span><h2>Your trading deserves<br />a better record.</h2></div>
        <Link className="landing-primary" to="/register">Create a free account <ArrowRight size={17} /></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/"><span className="landing-brand-icon"><TrendingUp size={17} /></span>EdgeJournal</Link>
        <span>Make every trade a lesson.</span>
        <Link to="/login">Sign in <ArrowRight size={14} /></Link>
      </footer>
    </main>
  );
}
