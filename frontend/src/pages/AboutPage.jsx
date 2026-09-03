import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { CategoryBars } from "../components/figures/CategoryBars.jsx";
import { OverviewStats } from "../components/figures/OverviewStats.jsx";
import { RadialTaxonomy } from "../components/figures/RadialTaxonomy.jsx";
import { RibbonChord } from "../components/figures/RibbonChord.jsx";
import { WorldMap } from "../components/figures/WorldMap.jsx";
import { SectionTitle } from "../components/ui/index.jsx";
import { COLORS, FONT_BODY } from "../theme/tokens.js";

export function AboutPage() {
  const navigate = useNavigate();

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
            Food is not just a cultural product — it is a living microbial ecosystem. Fermented
            dairy, wines, soy sauce and hundreds of other foods across every culture carry dynamic
            microbial communities and mobile genetic elements that continuously move between
            animals, the environment and humans. At the centre of that ecosystem sit{" "}
            <strong>plasmids</strong>: circular, self-replicating DNA molecules that move between
            bacteria independently of the host chromosome, carrying traits like antibiotic
            resistance, stress tolerance and enzyme production.
          </p>
          <p>
            Plasmids matter for both the technological and the safety sides of food. In
            fermentation they often encode traits central to the process itself — lactose and
            citrate utilisation, cell-envelope proteinases, exopolysaccharide synthesis and
            bacteriocins — alongside carbohydrate-active enzymes, heavy-metal resistance and
            defence systems such as CRISPR-Cas. They are also key vectors for{" "}
            <strong>antimicrobial resistance (AMR)</strong> genes, which makes food a direct route
            by which resistance genes can reach the human gut.
          </p>
          <p>
            Most plasmid research to date has focused on clinical settings — the human gut,
            bloodstream infections — or on environmental reservoirs like soil and water. Where food
            has been studied at all, it has mostly meant animal agriculture rather than the broader
            range of food people actually eat. The food-derived plasmidome has remained largely
            unexplored. GFPR was built to close that gap.
          </p>
          <p>
            For every sample, plasmid host taxonomy is predicted down to the family level, and
            contigs are annotated across six functional dimensions:{" "}
            <strong>AMR &amp; stress response genes</strong>, <strong>CAZymes</strong>,{" "}
            <strong>CRISPR-Cas systems</strong>, <strong>antimicrobial peptides</strong>,{" "}
            <strong>anticancer peptides</strong>, and{" "}
            <strong>Pfam / KEGG orthology groups</strong>.
          </p>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Every sample follows a <strong>Category → Type → Subtype</strong> hierarchy and is
            separately tagged as <strong>fermented</strong> or <strong>non-fermented</strong> —
            both are filterable on the Data Access page.
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
            <RadialTaxonomy />
            <CategoryBars
              metric="samples"
              onSelectCategory={(category) => goToSamples({ category })}
            />
            <CategoryBars
              metric="contigs"
              onSelectCategory={(category) => goToSamples({ category })}
            />
            <RibbonChord onSelectCategory={(category) => goToSamples({ category })} />
            <WorldMap onSelectCountry={(country) => goToSamples({ country })} />
          </div>
        </div>
      </section>
    </div>
  );
}
