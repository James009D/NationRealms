import {
  AgentAssignment,
  AgentRole,
  EconomyType,
  EventCategory,
  GovernmentType,
  MapLocationType,
  MilitaryUnitType,
  PostContentFormat,
  PostSourceType,
  NationPostType,
  PostVisibility,
  PrismaClient,
  ResourceType
} from "@prisma/client";
import { EVENT_TEMPLATES } from "../apps/api/src/data/eventTemplates.js";
import { ensureNationSettlements } from "../apps/api/src/services/settlementService.js";
import { ensureNationTechnology } from "../apps/api/src/services/technologyService.js";
import { initializeExistingNations } from "../apps/api/src/services/worldService.js";

const prisma = new PrismaClient();

async function upsertEventTemplates() {
  return Promise.all(
    EVENT_TEMPLATES.map((template) =>
      prisma.eventTemplate.upsert({
        where: { key: template.key },
        create: {
          key: template.key,
          title: template.title,
          description: template.description,
          category: template.category as EventCategory,
          tagsJson: template.tags,
          eligibilityJson: template.eligibility,
          choicesJson: template.choices,
          effectsJson: {},
          weight: template.weight,
          cooldownTurns: template.cooldownTurns ?? null,
          followUpEventKeysJson: template.followUpEventKeys ?? []
        },
        update: {
          title: template.title,
          description: template.description,
          category: template.category as EventCategory,
          tagsJson: template.tags,
          eligibilityJson: template.eligibility,
          choicesJson: template.choices,
          weight: template.weight,
          cooldownTurns: template.cooldownTurns ?? null,
          followUpEventKeysJson: template.followUpEventKeys ?? []
        }
      })
    )
  );
}

async function ensureSeedEconomy(nationId: string) {
  await prisma.nationEconomy.upsert({
    where: { nationId },
    create: { nationId, treasury: 1200, population: 1_100_000 },
    update: {}
  });
  await prisma.resourceStockpile.createMany({
    data: Object.values(ResourceType).map((type) => ({
      nationId,
      type,
      amount: type === ResourceType.FOOD ? 600 : type === ResourceType.ENERGY ? 350 : 180,
      capacity: 2000
    })),
    skipDuplicates: true
  });
}

async function backfillPostTags(nationId: string) {
  const seededPosts = await prisma.nationPost.findMany({ where: { nationId }, select: { id: true, tagsJson: true } });
  await prisma.nationPostTag.createMany({
    data: seededPosts.flatMap((post) =>
      (Array.isArray(post.tagsJson) ? post.tagsJson : [])
        .filter((tag): tag is string => typeof tag === "string")
        .map((value) => ({ postId: post.id, value: value.toLowerCase() }))
    ),
    skipDuplicates: true
  });
}

async function ensureDemoEngineer(nationId: string) {
  const mine = await prisma.mapLocation.findFirst({ where: { nationId, type: MapLocationType.MINE } });
  if (!mine) return null;
  const data = {
    role: AgentRole.ENGINEER,
    level: 2,
    xp: 140,
    loyalty: 79,
    health: 95,
    traitsJson: [
      {
        name: "Methodical Builder",
        description: "Plans public works around dependable crews and recoverable materials.",
        modifier: "-construction cost and duration"
      }
    ],
    skillsJson: [
      { name: "Civil Engineering", level: 2, xp: 125 },
      { name: "Project Management", level: 2, xp: 105 }
    ],
    assignment: AgentAssignment.IMPROVING,
    assignedLocationId: mine.id
  };
  const existing = await prisma.characterAgent.findFirst({ where: { nationId, name: "Engineer Ilyan Rook" } });
  return existing
    ? prisma.characterAgent.update({ where: { id: existing.id }, data })
    : prisma.characterAgent.create({ data: { nationId, name: "Engineer Ilyan Rook", ...data } });
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@statecraft.online" },
    create: {
      email: "demo@statecraft.online",
      displayName: "Demo Strategist"
    },
    update: { displayName: "Demo Strategist" }
  });

  const existingNation = await prisma.nation.findFirst({ where: { userId: user.id, name: "Aurelian Commonwealth" } });
  if (existingNation) {
    await upsertEventTemplates();
    await ensureSeedEconomy(existingNation.id);
    await ensureNationTechnology(prisma, existingNation.id, 50);
    await backfillPostTags(existingNation.id);
    await ensureDemoEngineer(existingNation.id);
    await initializeExistingNations();
    await ensureNationSettlements(existingNation.id, prisma);
    console.log(`Demo nation already seeded: ${existingNation.name}`);
    return;
  }

  const nation = await prisma.nation.create({
    data: {
      userId: user.id,
      name: "Aurelian Commonwealth",
      motto: "Many voices, one horizon",
      governmentType: GovernmentType.REPUBLIC,
      economyType: EconomyType.MIXED,
      foundingOrigin: "REVOLUTIONARY_REPUBLIC",
      cultureSummary:
        "A civic-minded coastal commonwealth balancing public institutions, private industry, and a strong tradition of local councils.",
      description:
        "The Aurelian Commonwealth is a coastal republic balancing public institutions, private industry, and civic localism.",
      capitalName: "Solmere",
      flagUrl: null,
      primaryColor: "#2f6f73",
      secondaryColor: "#f0c96d",
      accentColor: "#f3efe3",
      emblemSymbol: "Star",
      cultureTraitsJson: [
        { id: "merchant_guilds", label: "Merchant Guilds" },
        { id: "cosmopolitan_cities", label: "Cosmopolitan Cities" }
      ],
      ideologyJson: {
        authorityLiberty: 42,
        collectivismIndividualism: 55,
        militarismPacifism: 45,
        traditionProgress: 60,
        ecologyIndustry: 52
      },
      currentTurn: 3
    }
  });

  await prisma.nationStats.create({
    data: {
      nationId: nation.id,
      economy: 58,
      stability: 62,
      liberty: 70,
      authority: 45,
      military: 51,
      technology: 55,
      environment: 49,
      publicTrust: 64
    }
  });
  await ensureSeedEconomy(nation.id);
  await ensureNationTechnology(prisma, nation.id, 50);

  await prisma.nationPost.createMany({
    data: [
      {
        nationId: nation.id,
        type: NationPostType.GOVERNMENT_UPDATE,
        title: "Cabinet Opens Coastal Resilience Review",
        body: "The Commonwealth Council announced a **coastal resilience review** covering port defenses, harbor jobs, and flood planning after a season of rough storms.",
        format: PostContentFormat.MARKDOWN,
        sourceType: PostSourceType.PLAYER,
        visibility: PostVisibility.PUBLIC,
        tagsJson: ["infrastructure", "port"],
        excerpt:
          "The Commonwealth Council announced a coastal resilience review covering port defenses, harbor jobs, and flood planning.",
        publishedAt: new Date()
      },
      {
        nationId: nation.id,
        type: NationPostType.SPEECH,
        title: "Chancellor Vale Addresses the Assembly",
        body: "Chancellor Mara Vale called for patient reform, disciplined defense spending, and a renewed commitment to public works.\n\n> Many voices, one horizon.",
        format: PostContentFormat.MARKDOWN,
        sourceType: PostSourceType.PLAYER,
        visibility: PostVisibility.PUBLIC,
        tagsJson: ["speech", "culture"],
        excerpt: "Chancellor Mara Vale called for reform, disciplined defense spending, and renewed public works.",
        publishedAt: new Date()
      },
      {
        nationId: nation.id,
        type: NationPostType.NEWS,
        title: "Iron Output Rises Near Greyspan Mine",
        body: "Mine officials report a modest increase in output after new safety equipment and rail scheduling improvements came online.",
        format: PostContentFormat.MARKDOWN,
        sourceType: PostSourceType.PLAYER,
        visibility: PostVisibility.PUBLIC,
        tagsJson: ["economy", "mine"],
        excerpt: "Mine officials report a modest increase in output after safety and rail improvements.",
        publishedAt: new Date()
      },
      {
        nationId: nation.id,
        type: NationPostType.NEWS,
        title: "Draft: Harbor Interviews",
        body: "A draft collection of interviews with dock crews and merchants.",
        format: PostContentFormat.MARKDOWN,
        sourceType: PostSourceType.PLAYER,
        visibility: PostVisibility.DRAFT,
        tagsJson: ["draft", "port"],
        excerpt: "A draft collection of interviews with dock crews and merchants."
      }
    ]
  });

  const eventTemplates = await upsertEventTemplates();

  await prisma.activeEvent.create({
    data: {
      nationId: nation.id,
      eventTemplateId:
        eventTemplates.find((template) => template.key === "port_workers_strike")?.id ?? eventTemplates[0].id,
      generatedTurn: 3,
      expiresTurn: 6
    }
  });

  const resolvedEvent = await prisma.resolvedEvent.create({
    data: {
      nationId: nation.id,
      eventTemplateId:
        eventTemplates.find((template) => template.key === "national_day_speech")?.id ?? eventTemplates[0].id,
      title: "National Day Speech",
      selectedChoiceId: "unity",
      selectedChoiceLabel: "Call for unity",
      resultSummary: "The speech landed well and gave the government breathing room.",
      effectsJson: { statChanges: { stability: 3, publicTrust: 3 } },
      turn: 2
    }
  });

  await prisma.nationPost.create({
    data: {
      nationId: nation.id,
      type: NationPostType.SPEECH,
      title: "National Day Address Calls for Unity",
      body: "The head of state used the National Day address to call for patience, service, and unity.",
      format: PostContentFormat.MARKDOWN,
      sourceType: PostSourceType.EVENT,
      sourceEventHistoryId: resolvedEvent.id,
      visibility: PostVisibility.PUBLIC,
      tagsJson: ["event", "speech", "public_trust"],
      excerpt: "The National Day address called for patience, service, and unity.",
      publishedAt: new Date()
    }
  });

  const capital = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Solmere",
      type: MapLocationType.CAPITAL,
      x: 5,
      y: 4,
      population: 820000,
      developmentLevel: 5
    }
  });

  const port = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Brightwater Port",
      type: MapLocationType.PORT,
      x: 8,
      y: 6,
      resourceType: ResourceType.FISH,
      population: 190000,
      developmentLevel: 4
    }
  });

  const base = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Fort Ravel",
      type: MapLocationType.MILITARY_BASE,
      x: 3,
      y: 7,
      developmentLevel: 3
    }
  });

  const mine = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Greyspan Mine",
      type: MapLocationType.MINE,
      x: 2,
      y: 2,
      resourceType: ResourceType.IRON,
      population: 24000,
      developmentLevel: 2
    }
  });

  const farm = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Sunfield Cooperative",
      type: MapLocationType.FARM,
      x: 6,
      y: 8,
      resourceType: ResourceType.FOOD,
      population: 38000,
      developmentLevel: 3
    }
  });

  const town = await prisma.mapLocation.create({
    data: {
      nationId: nation.id,
      name: "Larkspur",
      type: MapLocationType.TOWN,
      x: 7,
      y: 2,
      population: 76000,
      developmentLevel: 2
    }
  });

  const headOfState = await prisma.characterAgent.create({
    data: {
      nationId: nation.id,
      name: "Mara Vale",
      role: AgentRole.HEAD_OF_STATE,
      level: 3,
      xp: 240,
      loyalty: 88,
      health: 96,
      traitsJson: [
        {
          name: "Consensus Builder",
          description: "Skilled at turning rival factions toward a shared compromise.",
          modifier: "+publicTrust from speeches"
        }
      ],
      skillsJson: [
        { name: "Oratory", level: 3, xp: 180 },
        { name: "Civic Reform", level: 2, xp: 90 }
      ],
      assignment: AgentAssignment.SPEAKING,
      assignedLocationId: capital.id
    }
  });

  const general = await prisma.characterAgent.create({
    data: {
      nationId: nation.id,
      name: "General Ivo Saren",
      role: AgentRole.GENERAL,
      level: 2,
      xp: 160,
      loyalty: 74,
      health: 91,
      traitsJson: [
        {
          name: "Cautious Planner",
          description: "Prefers prepared positions and reliable supply lines.",
          modifier: "+defense readiness"
        }
      ],
      skillsJson: [
        { name: "Command", level: 2, xp: 130 },
        { name: "Logistics", level: 2, xp: 115 }
      ],
      assignment: AgentAssignment.COMMANDING,
      assignedLocationId: base.id
    }
  });

  const governor = await prisma.characterAgent.create({
    data: {
      nationId: nation.id,
      name: "Governor Lin Adaro",
      role: AgentRole.GOVERNOR,
      level: 2,
      xp: 120,
      loyalty: 81,
      health: 98,
      traitsJson: [
        {
          name: "Practical Administrator",
          description: "Good at squeezing progress out of limited budgets.",
          modifier: "+development actions"
        }
      ],
      skillsJson: [
        { name: "Governance", level: 2, xp: 100 },
        { name: "Infrastructure", level: 1, xp: 55 }
      ],
      assignment: AgentAssignment.GOVERNING,
      assignedLocationId: town.id
    }
  });

  const engineer = await ensureDemoEngineer(nation.id);

  await prisma.militaryUnit.createMany({
    data: [
      {
        nationId: nation.id,
        name: "1st Solmere Infantry Brigade",
        type: MilitaryUnitType.INFANTRY,
        strength: 68,
        movement: 3,
        experience: 20,
        locationId: base.id,
        commanderAgentId: general.id
      },
      {
        nationId: nation.id,
        name: "Ravel Armored Battalion",
        type: MilitaryUnitType.ARMOR,
        strength: 74,
        movement: 4,
        experience: 25,
        locationId: base.id,
        commanderAgentId: general.id
      },
      {
        nationId: nation.id,
        name: "Brightwater Coastal Patrol",
        type: MilitaryUnitType.NAVAL,
        strength: 52,
        movement: 5,
        experience: 15,
        locationId: port.id,
        commanderAgentId: headOfState.id
      }
    ]
  });

  await backfillPostTags(nation.id);
  await initializeExistingNations();
  await ensureNationSettlements(nation.id, prisma);

  console.log(`Seeded demo nation: ${nation.name}`);
  console.log(`Demo user: ${user.email}`);
  console.log(`Map locations: ${[capital, port, base, mine, farm, town].map((location) => location.name).join(", ")}`);
  console.log(
    `Agents: ${[headOfState, general, governor, engineer]
      .filter(Boolean)
      .map((agent) => agent!.name)
      .join(", ")}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
