import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { CategoryBars } from "../components/figures/CategoryBars.jsx";
import { OverviewStats } from "../components/figures/OverviewStats.jsx";
import { RadialTaxonomy } from "../components/figures/RadialTaxonomy.jsx";
import { RibbonChord } from "../components/figures/RibbonChord.jsx";
import { WorldMap } from "../components/figures/WorldMap.jsx";
import { SectionTitle } from "../components/ui/index.jsx";
import { useApi } from "../api/useApi.js";
import { formatCount } from "../lib/format.js";
import { COLORS, FONT_BODY } from "../theme/tokens.js";

export function AboutPage() {
  const navigate = useNavigate();
  // The scope sentence reads from the live dataset rather than hardcoded
  // figures, so it cannot drift out of date after a re-import.
  const { data: overview } = useApi("/api/stats/overview");

  const goToSamples = (params) => {
    navigate(`/samples?${new URLSearchParams(params).toString()}`);
  };

  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <SectionTitle title="What is GFPR, and why does it matter?" align="center" />

        <div
          className="w-full md:w-[75%] mt-10 space-y-4 text-[15px] leading-relaxed mx-auto"
          style={{ color: COLORS.ink, fontFamily: FONT_BODY, textAlign: "left" }}
        >
          <p>
            Foods are microbial ecosystems, and the bacteria in them
            carry mobile genetic elements that circulate between the food chain, the environment,
            livestock and people. Chief among these are <strong>plasmids</strong>: circular DNA
            molecules that replicate independently of the bacterial chromosome and transfer between
            cells, carrying accessory traits with them.
          </p>
          <p>
            In a food context those traits cut two ways. Plasmids frequently encode functions
            central to fermentation itself — lactose and citrate utilisation, cell-envelope
            proteinases, exopolysaccharide synthesis and bacteriocin production — alongside
            carbohydrate-active enzymes, heavy-metal resistance and CRISPR-Cas defence systems.
            They are also principal vehicles for <strong>antimicrobial resistance (AMR)</strong>{" "}
            determinants, which makes the food chain a plausible route by which resistance genes
            reach the human gut.
          </p>
          <p>
            Plasmid biology has nonetheless been characterised largely in clinical settings — the
            human gut, bloodstream infection — and in environmental reservoirs such as soil and
            water. Where food has been sampled at all, it has usually meant animal production
            rather than the breadth of what people actually eat. The food-derived plasmidome has
            consequently remained poorly described.
          </p>
          <p>
            GFPR was assembled to address that gap: a systematic, openly accessible catalogue of
            plasmid sequences recovered from food-associated metagenomes.
            {overview ? (
              <>
                {" "}It currently comprises{" "}
                <strong>{formatCount(overview.totalPlasmidContigs)}</strong> plasmid contigs from{" "}
                <strong>{formatCount(overview.totalSamples)}</strong> samples spanning{" "}
                <strong>{overview.categories}</strong> food categories and{" "}
                <strong>{overview.countries}</strong> countries, drawn from{" "}
                {(overview.databaseOrigins || []).length} public and in-house sources.
              </>
            ) : null}
          </p>
          <p>
            For every sample, plasmid host taxonomy is resolved to family level, and contigs are
            annotated across six functional dimensions:{" "}
            <strong>AMR &amp; stress response genes</strong>, <strong>CAZymes</strong>,{" "}
            <strong>CRISPR-Cas systems</strong>, <strong>antimicrobial peptides</strong>,{" "}
            <strong>anticancer peptides</strong>, and{" "}
            <strong>Pfam / KEGG orthology groups</strong>. Every record is traceable to its source
            run accession, and the underlying tables can be exported in full.
          </p>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Samples follow a <strong>Category → Type → Subtype</strong> hierarchy and are
            separately labelled <strong>fermented</strong> or <strong>non-fermented</strong>; both
            are filterable on the Data Access page.
          </p>

          <div className="flex flex-wrap items-center justify-start gap-5 mt-2">
            <a
              href="https://github.com/sarifs-ui/foodplasmidwebsite"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: COLORS.berry }}
            >
              <FaGithub className="w-4 h-4" aria-hidden="true" /> View on GitHub
            </a>
            <a
              href="https://arikanlab.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: COLORS.darkTeal }}
            >
              Arıkan Lab <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>

        <OverviewStats />

        <div className="mt-14">
          <SectionTitle title="Explore the data" />
          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            <CategoryBars
              metric="samples"
              onSelectCategory={(category) => goToSamples({ category })}
            />
            <CategoryBars
              metric="contigs"
              onSelectCategory={(category) => goToSamples({ category })}
            />
            <WorldMap onSelectCountry={(country) => goToSamples({ country })} />
            <RadialTaxonomy />
            <RibbonChord onSelectCategory={(category) => goToSamples({ category })} />
          </div>
        </div>
      </section>
    </div>
  );
}
