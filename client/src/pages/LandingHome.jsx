import { useEffect, useState } from "react";
import { getPaginatedSchemes } from "../services/api";
import Chakra from "../components/Chakra";

const SchemeTile = ({ scheme, onViewDetails, duplicate = false }) => (
  <article
    className="scheme"
    onClick={() => !duplicate && onViewDetails?.(scheme)}
    role="button"
    tabIndex={duplicate ? -1 : 0}
    aria-hidden={duplicate || undefined}
    onKeyDown={(e) => {
      if (!duplicate && e.key === "Enter") onViewDetails?.(scheme);
    }}
  >
    <div className="scheme__top">
      {scheme.category && <span className="tag-cat">{scheme.category}</span>}
      <span className="scheme__state">{scheme.state || "All India"}</span>
    </div>
    <h3 className="scheme__name">{scheme.name}</h3>
    <p className="scheme__desc">
      {scheme.description || "Government benefit scheme. View details to learn more."}
    </p>
    <div className="scheme__foot">
      <span className="scheme__ministry">
        {scheme.ministry || "Central Government"}
      </span>
      <span className="scheme__cta">
        Explore <span className="arw">↗</span>
      </span>
    </div>
  </article>
);

const LandingHome = ({ onViewDetails, onTabChange }) => {
  const [schemes, setSchemes] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaginatedSchemes(1, 6)
      .then((data) => {
        if (data?.schemes) setSchemes(data.schemes);
        if (typeof data?.meta?.total === "number") setTotal(data.meta.total);
      })
      .catch((err) => console.error("Backend connection failure:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".reveal:not(.is-in)");
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [schemes, loading]);

  const goToSearch = () => onTabChange?.("search");
  const scrollToHow = () =>
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="view">
      {/* HERO */}
      <section className="hero">
        <div className="container container--wide hero__inner">
          <div className="hero__copy">
            <h1 className="display hero__title">
              <span className="line"><span>Most people qualify</span></span>
              <span className="line"><span>for a scheme they've</span></span>
              <span className="line"><span><em>never heard of.</em></span></span>
            </h1>

            <p className="hero__lede">
              Scholarships, pensions, subsidies, insurance — thousands of central and
              state programs go unclaimed every year simply because nobody knew to look.
              Describe your situation and we'll narrow it down to what actually applies.
            </p>

            <div className="hero__actions">
              <button type="button" className="btn btn--night btn--lg" onClick={goToSearch}>
                Find my schemes <span className="arw">→</span>
              </button>
              <button type="button" className="tlink" onClick={scrollToHow}>
                How it works <span className="arw">↓</span>
              </button>
            </div>

            {total !== null && (
              <div className="hero__fact">
                <span className="num">{total.toLocaleString("en-IN")}</span>
                <span>+ schemes</span>
              </div>
            )}
          </div>

          <div className="hero__orrery">
            <Chakra />
          </div>
        </div>

        <div className="hero__showcase container container--wide">
          <div className="hero__showcase-head">
            <div>
              <h2>Schemes people are <em>checking right now.</em></h2>
            </div>
            <button type="button" className="tlink" onClick={goToSearch}>
              See the full list <span className="arw">→</span>
            </button>
          </div>

          <div className="hero__scheme-rail" aria-label="Featured schemes">
            <div className="hero__scheme-track">
              {[false, true].map((duplicate) => (
                <div
                  className="hero__scheme-group"
                  key={duplicate ? "reel-copy" : "reel-main"}
                  aria-hidden={duplicate || undefined}
                  inert={duplicate}
                >
                  {loading
                    ? [0, 1, 2, 3, 4, 5].map((n) => (
                        <div className="scheme hero__scheme-skeleton" key={`${duplicate}-${n}`} aria-hidden="true">
                          <div className="index-skeleton" style={{ padding: 0, border: 0, flex: 1 }}>
                            <div style={{ width: "42%", height: 20 }} />
                            <div style={{ width: "70%", height: 12 }} />
                          </div>
                        </div>
                      ))
                    : schemes.map((scheme, i) => (
                        <SchemeTile
                          key={`${duplicate ? "copy-" : ""}${scheme.id || `${scheme.name}-${i}`}`}
                          scheme={scheme}
                          onViewDetails={onViewDetails}
                          duplicate={duplicate}
                        />
                      ))}
                </div>
              ))}
            </div>
          </div>

          {!loading && schemes.length === 0 && (
            <p className="hero__scheme-empty">
              Schemes couldn't be loaded right now. Please check your connection and try again.
            </p>
          )}
        </div>
      </section>

      {/* INTRO */}
      <section className="section">
        <div className="container split">
          <h2 className="split__aside reveal">
            There's a scheme for almost everything.
            <br />
            <em>Finding it is the hard part.</em>
          </h2>

          <div className="prose reveal">
            <p>
              Housing, education, farming, healthcare, pensions — programs exist for most
              of it, scattered across central and state departments, each with its own
              paperwork, thresholds and cut-off dates.
            </p>
            <p>
              <strong>Scheme Companion asks a few questions</strong> about who you are and
              where you live, then narrows thousands of listings down to the ones that
              genuinely apply to you — ranked by how closely they match, never by
              guesswork.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="band-night section" id="how-it-works">
        <div className="container">
          <div className="sec-head reveal">
            <span className="kicker">The process</span>
            <h2>Three steps, <em>start to finish.</em></h2>
            <p className="lede">
              No forms to file here — we point you to the official page for each scheme.
            </p>
          </div>

          <div className="steps">
            {[
              {
                n: "01",
                t: "Tell us about yourself",
                d: "Age, occupation, state, income — the details that actually decide what you're eligible for.",
              },
              {
                n: "02",
                t: "See what you match",
                d: "We check your details against each scheme's eligibility rules and rank what's worth reading.",
              },
              {
                n: "03",
                t: "Apply on the official site",
                d: "Every result links straight to the government page. We don't process applications ourselves.",
              },
            ].map((s) => (
              <article className="step reveal" key={s.n}>
                <span className="step__bar" />
                <span className="step__n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="band-night section closing-cta">
        <div className="container" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div className="reveal" style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 className="display" style={{ fontSize: "clamp(30px,4.4vw,52px)", color: "var(--night-ink)" }}>
              Chances are, one of these<br /><em style={{ color: "var(--night-ink)", fontStyle: "italic" }}>schemes is meant for you.</em>
            </h2>
            <p className="lede" style={{ margin: "22px auto 0", maxWidth: 480, color: "var(--night-muted)" }}>
              It takes about two minutes to find out what fits.
            </p>
            <button
              type="button"
              className="btn btn--night btn--lg"
              style={{ marginTop: 32 }}
              onClick={goToSearch}
            >
              Check what I qualify for <span className="arw">→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingHome;
