import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { multiselect, select, isCancel } from "@clack/prompts";

const SUPPORTED_AGENTS = ["copilot", "opencode", "claude-code", "zcode", "qoder", "kilocode"];

const TOOL_PROFILES = {
  copilot: {
    label: "GitHub Copilot (VS Code)",
    projectDir: ".github",
    homeDir: ".copilot",
    agentDir: "agents",
    promptDir: "prompts",
    skillDir: "skills",
    agentExt: ".agent.md",
    promptExt: ".prompt.md",
    templateProfile: "copilot",
  },
  opencode: {
    label: "OpenCode",
    projectDir: ".opencode",
    homeDir: ".config/opencode",
    agentDir: "agents",
    promptDir: "commands",
    skillDir: "skills",
    agentExt: ".md",
    promptExt: ".md",
    templateProfile: "opencode",
    // OpenCode has no official rules directory convention yet (AGENTS.md +
    // opencode.json instructions is the official path). The rule is installed
    // for structural uniformity and forward-compatibility.
    ruleDir: "rules",
  },
  "claude-code": {
    label: "Claude Code",
    projectDir: ".claude",
    homeDir: ".claude",
    agentDir: "agents",
    promptDir: "commands",
    skillDir: "skills",
    agentExt: ".md",
    promptExt: ".md",
    templateProfile: "opencode",
    // Claude Code supports modular project rules in .claude/rules/*.md
    // (official memory docs) — same conventions rule as Qoder.
    ruleDir: "rules",
  },
  zcode: {
    label: "ZCode (Z.ai)",
    projectDir: ".zcode",
    homeDir: ".zcode",
    agentDir: "agents",
    promptDir: "commands",
    skillDir: "skills",
    agentExt: ".md",
    promptExt: ".md",
    templateProfile: "opencode",
    // Rules directory support is unverified for ZCode; the rule is installed
    // for structural uniformity and forward-compatibility.
    ruleDir: "rules",
  },
  qoder: {
    label: "Qoder",
    projectDir: ".qoder",
    homeDir: ".qoder",
    agentDir: "agents",
    promptDir: "commands",
    skillDir: "skills",
    agentExt: ".md",
    promptExt: ".md",
    templateProfile: "opencode",
    // Qoder custom agents use the same shape as OpenCode (frontmatter with
    // name/description/tools + markdown body) in agents/, so the opencode
    // shell templates work as-is. Qoder additionally supports project rules,
    // which carry the lifecycle conventions.
    ruleDir: "rules",
  },
  kilocode: {
    label: "Kilo Code",
    projectDir: ".kilo",
    homeDir: ".config/kilo",
    agentDir: "agents",
    promptDir: "commands",
    skillDir: "skills",
    agentExt: ".md",
    promptExt: ".md",
    templateProfile: "opencode",
    // Kilo Code (OpenCode fork) keeps global skills in ~/.kilo/skills
    // (KilocodePaths.skillDirectories) while global commands/agents live in
    // the XDG config dir ~/.config/kilo — hence the separate skill home.
    globalSkillHome: ".kilo",
    // Kilo has a custom rules concept; the rule is installed for uniformity.
    ruleDir: "rules",
  },
};

const TECHNICAL_AGENT_NAMES = new Set(["es-architect", "es-database-designer", "es-developer", "es-tester"]);
const MODEL_PRESETS = {
  balanced: {
    technicalModel: "GPT-5 (copilot)",
    nonTechnicalModel: "Claude Sonnet 4.5 (copilot)",
  },
  speed: {
    technicalModel: "Claude Sonnet 4.5 (copilot)",
    nonTechnicalModel: "Claude Sonnet 4.5 (copilot)",
  },
  quality: {
    technicalModel: "GPT-5 (copilot)",
    nonTechnicalModel: "GPT-5 (copilot)",
  },
};

export function copilotUserPromptDir(homeDir = os.homedir()) {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      return null;
    }
    return path.join(appData, "Code", "User", "prompts");
  }

  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "Code", "User", "prompts");
  }

  return path.join(homeDir, ".config", "Code", "User", "prompts");
}

function defaultPromptSourcePath() {
  return copilotUserPromptDir();
}

function defaultAgentSourcePath() {
  return path.join(os.homedir(), ".copilot", "agents");
}

function defaultSkillSourcePath() {
  return path.join(os.homedir(), ".copilot", "skills");
}

function printHelp() {
  console.log(`easyspec-init

Usage:
  easyspec <command> [options]

Commands:
  init        Install commands, agents, rules, and skills for target harness(es)
  list        Show which easyspec entities are installed per harness
  uninstall   Remove the es-* files easyspec installed
  sync        Refresh template profiles from installed sources (maintainers)

Options:
  --agent <copilot,opencode,claude-code,zcode,qoder,kilocode>
                                  Coding agent(s) (comma-separated; prompts
                                  interactively if omitted)
  --scope <project|global>        Install scope (prompts interactively if omitted)
  --workspace <path>              Project folder for --scope project (default: cwd)
  --force                         Overwrite existing files
  --dry-run                       Preview without writing (lists every file)
  --source-prompts <path>         Source prompt directory for sync command
  --source-agents <path>          Source agent directory for sync command
  --source-skills <path>          Source skills directory for sync command
  --template-profile <name>       Template profile to refresh (default: copilot)
  --include-agents <a,b,c>        Optional explicit agent list for sync
  --tech-model <name>             Model for technical agents (default: auto;
                                  only applies to Copilot agent files)
  --non-tech-model <name>         Model for non-technical agents (default: auto;
                                  only applies to Copilot agent files)
  --model-preset <balanced|speed|quality>
                                  Apply preset model pair before explicit overrides
  --help                          Show this help

Examples:
  easyspec init
  easyspec init --agent copilot --scope project
  easyspec init --agent copilot,claude-code --scope project
  easyspec init --agent opencode --scope global
  easyspec init --agent zcode,qoder --scope project
  easyspec init --agent kilocode --scope global
  easyspec init --scope project --model-preset balanced
  easyspec list --agent qoder --scope project
  easyspec uninstall --agent copilot --scope project --dry-run
  easyspec sync --template-profile copilot
`);
}

function readOptionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}. Usage: easyspec ${flag} <value>`);
  }
  return value;
}

function parseArgs(argv) {
  const args = {
    command: null,
    agents: null,
    scope: "project",
    workspace: process.cwd(),
    force: false,
    dryRun: false,
    sourcePrompts: defaultPromptSourcePath(),
    sourceAgents: defaultAgentSourcePath(),
    sourceSkills: defaultSkillSourcePath(),
    templateProfile: "copilot",
    includeAgents: null,
    techModel: null,
    nonTechModel: null,
    modelPreset: null,
    agentsExplicit: false,
    scopeExplicit: false,
    help: false,
  };

  if (argv.length === 0) {
    args.help = true;
    return args;
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    args.help = true;
    return args;
  }

  args.command = argv[0];

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--scope") {
      args.scope = readOptionValue(argv, i, "--scope");
      args.scopeExplicit = true;
      i += 1;
    } else if (token === "--agent") {
      const values = readOptionValue(argv, i, "--agent")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      args.agents = args.agents ? args.agents.concat(values) : values;
      args.agentsExplicit = true;
      i += 1;
    } else if (token === "--workspace") {
      args.workspace = path.resolve(readOptionValue(argv, i, "--workspace"));
      i += 1;
    } else if (token === "--source-prompts") {
      args.sourcePrompts = path.resolve(readOptionValue(argv, i, "--source-prompts"));
      i += 1;
    } else if (token === "--source-agents") {
      args.sourceAgents = path.resolve(readOptionValue(argv, i, "--source-agents"));
      i += 1;
    } else if (token === "--source-skills") {
      args.sourceSkills = path.resolve(readOptionValue(argv, i, "--source-skills"));
      i += 1;
    } else if (token === "--template-profile") {
      args.templateProfile = readOptionValue(argv, i, "--template-profile");
      i += 1;
    } else if (token === "--include-agents") {
      args.includeAgents = readOptionValue(argv, i, "--include-agents")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      i += 1;
    } else if (token === "--tech-model") {
      args.techModel = readOptionValue(argv, i, "--tech-model");
      i += 1;
    } else if (token === "--non-tech-model") {
      args.nonTechModel = readOptionValue(argv, i, "--non-tech-model");
      i += 1;
    } else if (token === "--model-preset") {
      args.modelPreset = readOptionValue(argv, i, "--model-preset");
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function getProjectRoot(agent, workspace) {
  const profile = TOOL_PROFILES[agent];
  if (!profile) {
    throw new Error(`Unsupported agent '${agent}'.`);
  }
  return path.resolve(workspace, profile.projectDir);
}

function getHomeRoot(agent) {
  const profile = TOOL_PROFILES[agent];
  if (!profile) {
    throw new Error(`Unsupported agent '${agent}'.`);
  }
  return path.join(os.homedir(), profile.homeDir);
}

function resolveGlobalPromptDir(agent, homeRoot) {
  if (agent === "copilot") {
    return copilotUserPromptDir();
  }
  const profile = TOOL_PROFILES[agent];
  return path.join(homeRoot, profile.promptDir);
}

function ensureDir(dirPath, dryRun) {
  if (!dryRun) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFileWithPolicy(src, dest, options) {
  const { force, dryRun } = options;
  const exists = fs.existsSync(dest);
  if (exists && !force) {
    return "skipped";
  }

  if (!dryRun) {
    fs.copyFileSync(src, dest);
  }
  return exists ? "overwritten" : "copied";
}

function mergeSummary(target, partial) {
  target.copied += partial.copied;
  target.overwritten += partial.overwritten;
  target.skipped += partial.skipped;
  if (partial.files) {
    target.files.push(...partial.files);
  }
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return { frontmatter: {}, body: content };
  }

  const closeIdx = content.indexOf("\n---\n", 4);
  if (closeIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const fmBlock = content.slice(4, closeIdx);
  const body = content.slice(closeIdx + 5);

  const frontmatter = {};
  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function findGenericTemplate(templateDir) {
  const entries = fs.readdirSync(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith("_template")) {
      return path.join(templateDir, entry.name);
    }
  }
  return null;
}

function renderEntitiesFromContent(templateDir, destDir, contentDir, entityType, entityExt, options) {
  const summary = { copied: 0, overwritten: 0, skipped: 0, files: [] };

  const genericTemplatePath = findGenericTemplate(templateDir);
  if (!genericTemplatePath) {
    return summary;
  }

  const genericTemplate = fs.readFileSync(genericTemplatePath, "utf8");
  const contentEntityDir = path.join(contentDir, entityType);
  if (!fs.existsSync(contentEntityDir)) {
    return summary;
  }

  const bodyFiles = fs.readdirSync(contentEntityDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".body.md"));

  for (const bodyFile of bodyFiles) {
    const bodyPath = path.join(contentEntityDir, bodyFile.name);
    const bodyContent = fs.readFileSync(bodyPath, "utf8");
    const { frontmatter, body } = parseFrontmatter(bodyContent);

    const entityName = frontmatter.name || bodyFile.name.replace(".body.md", "");
    const destName = `${entityName}${entityExt}`;
    const destPath = path.join(destDir, destName);
    const exists = fs.existsSync(destPath);

    if (exists && !options.force) {
      summary.skipped += 1;
      continue;
    }

    let rendered = genericTemplate
      .replace(/{{name}}/g, frontmatter.name || "")
      .replace(/{{description}}/g, frontmatter.description || "")
      .replace(/{{model}}/g, frontmatter.model || "")
      .replace(/{{tools}}/g, frontmatter.tools || "")
      .replace(/{{body}}/g, body.trimEnd());

    if (!options.dryRun) {
      ensureDir(destDir, false);
      fs.writeFileSync(destPath, rendered, "utf8");
    }
    summary.files.push({ action: exists ? "overwrite" : "create", path: destPath });
    summary[exists ? "overwritten" : "copied"] += 1;
  }

  return summary;
}

function copySkillDirectory(srcSkillDir, destSkillDir, contentDir, options) {
  const summary = { copied: 0, overwritten: 0, skipped: 0, files: [] };
  if (!fs.existsSync(srcSkillDir)) {
    return summary;
  }

  ensureDir(destSkillDir, options.dryRun);

  const entries = fs.readdirSync(srcSkillDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillSrc = path.join(srcSkillDir, entry.name);
    const skillDest = path.join(destSkillDir, entry.name);
    const skillFiles = fs.readdirSync(skillSrc, { withFileTypes: true });
    ensureDir(skillDest, options.dryRun);
    for (const skillFile of skillFiles) {
      if (!skillFile.isFile() || skillFile.name.endsWith(".body.md")) {
        continue;
      }
      const sfSrc = path.join(skillSrc, skillFile.name);
      const sfDest = path.join(skillDest, skillFile.name);
      const exists = fs.existsSync(sfDest);

      if (exists && !options.force) {
        summary.skipped += 1;
        continue;
      }

      const rendered = renderTemplate(sfSrc, contentDir, options, `skills/${entry.name}`);
      if (rendered === null) {
        summary.skipped += 1;
        continue;
      }

      if (!options.dryRun) {
        fs.writeFileSync(sfDest, rendered, "utf8");
      }
      summary.files.push({ action: exists ? "overwrite" : "create", path: sfDest });
      summary[exists ? "overwritten" : "copied"] += 1;
    }
  }

  return summary;
}

function renderTemplate(templatePath, contentDir, options, bodySubPath) {
  const template = fs.readFileSync(templatePath, "utf8");
  if (!template.includes("{{body}}")) {
    return template;
  }

  const entType = bodySubPath || path.basename(path.dirname(templatePath));
  const templateName = path.basename(templatePath);
  const bodyName = templateName.replace(/\.(agent|prompt)\.md$/, ".body.md");
  const finalBodyName = bodyName === templateName ? templateName.replace(/\.md$/, ".body.md") : bodyName;
  const bodyPath = path.join(contentDir, entType, finalBodyName);

  if (!fs.existsSync(bodyPath)) {
    if (!options.silent) {
      console.warn(`[easyspec-init] no body content found for ${templateName}, skipping`);
    }
    return null;
  }

  const body = fs.readFileSync(bodyPath, "utf8").trimEnd();
  return template.replace("{{body}}", body);
}

function installToRoot(rootPath, promptsDest, sourceRoot, contentRoot, agent, options, skillsDestOverride) {
  const profile = TOOL_PROFILES[agent];
  const promptsSrc = path.join(sourceRoot, "prompts");
  const agentsSrc = path.join(sourceRoot, "agents");
  const agentsDest = path.join(rootPath, profile.agentDir);
  const skillsDest = skillsDestOverride ?? path.join(rootPath, profile.skillDir);

  const summary = {
    copied: 0,
    overwritten: 0,
    skipped: 0,
    files: [],
  };

  if (promptsDest) {
    mergeSummary(summary, renderEntitiesFromContent(promptsSrc, promptsDest, contentRoot, "prompts", profile.promptExt, options));
  }
  if (!profile.skipAgents) {
    mergeSummary(summary, renderEntitiesFromContent(agentsSrc, agentsDest, contentRoot, "agents", profile.agentExt, options));
  }
  if (profile.ruleDir) {
    // Rules reuse the prompt shell template — Qoder rules are plain markdown
    // with a name/description frontmatter, exactly like opencode prompts.
    mergeSummary(summary, renderEntitiesFromContent(promptsSrc, path.join(rootPath, profile.ruleDir), contentRoot, "rules", ".md", options));
  }

  const contentSkillsDir = path.join(contentRoot, "skills");
  mergeSummary(summary, copySkillDirectory(contentSkillsDir, skillsDest, contentRoot, options));

  return {
    rootPath,
    promptsDest,
    agent,
    ...summary,
  };
}

function resolveSourceRoot(baseTemplatesDir, agent) {
  const profile = TOOL_PROFILES[agent];
  if (!profile || !profile.templateProfile) {
    throw new Error(`No template profile mapped for agent '${agent}'.`);
  }
  return path.join(baseTemplatesDir, profile.templateProfile);
}

function resolveContentRoot(baseTemplatesDir) {
  return path.join(baseTemplatesDir, "content");
}

function collectPromptFiles(promptDir) {
  if (!promptDir || !fs.existsSync(promptDir)) {
    throw new Error(`Prompt source directory does not exist: ${promptDir}`);
  }
  return fs
    .readdirSync(promptDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^es-.*\.prompt\.md$/i.test(entry.name))
    .map((entry) => path.join(promptDir, entry.name));
}

function inferAgentNamesFromPrompts(promptFiles) {
  const names = new Set();
  const re = /\*\*(?<name>[A-Za-z0-9_-]+)\s+agent\*\*/gi;

  for (const filePath of promptFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    let match = re.exec(content);
    while (match) {
      names.add(match.groups.name);
      match = re.exec(content);
    }
    re.lastIndex = 0;
  }

  return Array.from(names).sort();
}

function syncTemplates(args, templatesDir, dryRun, force) {
  const availableProfiles = fs.readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(templatesDir, entry.name, "agents")))
    .map((entry) => entry.name);
  if (!availableProfiles.includes(args.templateProfile)) {
    throw new Error(`Unknown template profile '${args.templateProfile}'. Available profiles: ${availableProfiles.join(", ")}.`);
  }

  const profileDir = path.join(templatesDir, args.templateProfile);
  const contentRoot = resolveContentRoot(templatesDir);
  const promptDestDir = path.join(profileDir, "prompts");
  const agentDestDir = path.join(profileDir, "agents");
  const skillDestDir = path.join(profileDir, "skills");

  if (!dryRun) {
    fs.mkdirSync(promptDestDir, { recursive: true });
    fs.mkdirSync(agentDestDir, { recursive: true });
    fs.mkdirSync(skillDestDir, { recursive: true });
  }

  const promptFiles = collectPromptFiles(args.sourcePrompts);
  const agentNames = args.includeAgents || inferAgentNamesFromPrompts(promptFiles);
  const summary = {
    prompts: { copied: 0, overwritten: 0, skipped: 0 },
    agents: { copied: 0, overwritten: 0, skipped: 0, missing: [] },
    skills: { copied: 0, overwritten: 0, skipped: 0, files: [] },
  };

  for (const srcPromptFile of promptFiles) {
    const destPromptFile = path.join(promptDestDir, path.basename(srcPromptFile));
    const result = copyFileWithPolicy(srcPromptFile, destPromptFile, { force, dryRun });
    summary.prompts[result] += 1;
  }

  for (const agentName of agentNames) {
    // Accept both the official Copilot .agent.md naming and plain .md sources.
    const srcAgentFile = [`${agentName}.agent.md`, `${agentName}.md`]
      .map((name) => path.join(args.sourceAgents, name))
      .find((file) => fs.existsSync(file));
    if (!srcAgentFile) {
      summary.agents.missing.push(agentName);
      continue;
    }
    const destAgentFile = path.join(agentDestDir, path.basename(srcAgentFile));
    const result = copyFileWithPolicy(srcAgentFile, destAgentFile, { force, dryRun });
    summary.agents[result] += 1;
  }

  if (args.sourceSkills && fs.existsSync(args.sourceSkills)) {
    mergeSummary(summary.skills, copySkillDirectory(args.sourceSkills, skillDestDir, contentRoot, { force, dryRun }));
  }

  return {
    profileDir,
    sourcePrompts: args.sourcePrompts,
    sourceAgents: args.sourceAgents,
    agentNames,
    summary,
  };
}

function chooseModelKind(agentFileName) {
  const bare = agentFileName.replace(/(?:\.agent)?\.md$/i, "");
  return TECHNICAL_AGENT_NAMES.has(bare) ? "technical" : "non-technical";
}

function upsertModelInFrontmatter(content, model) {
  if (!content.startsWith("---\n")) {
    return content;
  }

  const closeIdx = content.indexOf("\n---\n", 4);
  if (closeIdx === -1) {
    return content;
  }

  const frontmatterBlock = content.slice(0, closeIdx + 5);
  const rest = content.slice(closeIdx + 5);
  const modelRe = /^model:\s*.*$/m;

  if (modelRe.test(frontmatterBlock)) {
    return `${frontmatterBlock.replace(modelRe, `model: "${model}"`)}${rest}`;
  }

  return content;
}

function applyModelSelectionsToRoot(rootPath, selection, dryRun) {
  const agentsDir = path.join(rootPath, "agents");
  const summary = {
    updated: 0,
    skipped: 0,
  };

  if (!fs.existsSync(agentsDir)) {
    return summary;
  }

  const files = fs.readdirSync(agentsDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
  for (const entry of files) {
    const modelKind = chooseModelKind(entry.name);
    const chosenModel = modelKind === "technical" ? selection.technicalModel : selection.nonTechnicalModel;
    if (!chosenModel || chosenModel === "auto") {
      summary.skipped += 1;
      continue;
    }

    const filePath = path.join(agentsDir, entry.name);
    const current = fs.readFileSync(filePath, "utf8");
    const updated = upsertModelInFrontmatter(current, chosenModel);
    if (updated === current) {
      summary.skipped += 1;
      continue;
    }

    if (!dryRun) {
      fs.writeFileSync(filePath, updated, "utf8");
    }
    summary.updated += 1;
  }

  return summary;
}

function resolveDestRoots(agent, scope, workspace) {
  const profile = TOOL_PROFILES[agent];
  if (scope === "project") {
    const root = getProjectRoot(agent, workspace);
    return {
      root,
      prompts: path.join(root, profile.promptDir),
      agents: profile.skipAgents ? null : path.join(root, profile.agentDir),
      skills: path.join(root, profile.skillDir),
      rules: profile.ruleDir ? path.join(root, profile.ruleDir) : null,
    };
  }

  const homeRoot = getHomeRoot(agent);
  const globalSkillBase = profile.globalSkillHome ? path.join(os.homedir(), profile.globalSkillHome) : null;
  return {
    root: homeRoot,
    prompts: resolveGlobalPromptDir(agent, homeRoot),
    agents: profile.skipAgents ? null : path.join(homeRoot, profile.agentDir),
    skills: globalSkillBase ? path.join(globalSkillBase, profile.skillDir) : path.join(homeRoot, profile.skillDir),
    rules: profile.ruleDir ? path.join(homeRoot, profile.ruleDir) : null,
  };
}

function expectedEntityNames(contentRoot) {
  const bodyNames = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".body.md"))
    .map((entry) => entry.name.replace(/\.body\.md$/, ""));

  const rulesDir = path.join(contentRoot, "rules");
  return {
    prompts: bodyNames(path.join(contentRoot, "prompts")),
    agents: bodyNames(path.join(contentRoot, "agents")),
    skills: fs.readdirSync(path.join(contentRoot, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
    rules: fs.existsSync(rulesDir) ? bodyNames(rulesDir) : [],
  };
}

function listEsEntries(dirPath, { dirs = false } = {}) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => (dirs ? entry.isDirectory() : entry.isFile()) && entry.name.startsWith("es-"))
    .map((entry) => entry.name);
}

function inspectCategory(profile, kind, dir, expectedNames) {
  if (kind === "skill") {
    const missing = expectedNames.filter((name) => !fs.existsSync(path.join(dir, name, "SKILL.md")));
    const extra = listEsEntries(dir, { dirs: true }).filter((name) => !expectedNames.includes(name));
    return { missing, extra };
  }

  const ext = kind === "prompt" ? profile.promptExt : kind === "agent" ? profile.agentExt : ".md";
  const missing = expectedNames.filter((name) => !fs.existsSync(path.join(dir, `${name}${ext}`)));
  const extra = listEsEntries(dir)
    .map((name) => name.replace(/(?:\.prompt|\.agent)?\.md$/i, ""))
    .filter((name) => !expectedNames.includes(name));
  return { missing, extra };
}

function listInstalled(args, agents, scope, templatesDir) {
  const expected = expectedEntityNames(resolveContentRoot(templatesDir));

  for (const agent of agents) {
    const profile = TOOL_PROFILES[agent];
    const dests = resolveDestRoots(agent, scope, args.workspace);
    console.log(`[easyspec-init] ${agent} (${scope}) — root: ${dests.root}`);

    const categories = [
      ["prompts", dests.prompts, expected.prompts, "prompt"],
      ["agents", dests.agents, expected.agents, "agent"],
      ["rules", dests.rules, expected.rules, "prompt"],
      ["skills", dests.skills, expected.skills, "skill"],
    ];

    for (const [label, dir, names, kind] of categories) {
      if (!dir || (names.length === 0 && listEsEntries(dir, { dirs: kind === "skill" }).length === 0)) {
        continue;
      }
      const { missing, extra } = inspectCategory(profile, kind, dir, names);
      const status = missing.length === 0 ? `complete (${names.length})` : `${names.length - missing.length}/${names.length} installed`;
      const notes = [];
      if (missing.length > 0) {
        notes.push(`missing: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        notes.push(`extra es-* entries: ${extra.join(", ")}`);
      }
      console.log(`  ${label.padEnd(8)} ${status}${notes.length > 0 ? ` — ${notes.join("; ")}` : ""}`);
      console.log(`           ${dir}`);
    }
  }
}

function uninstallInstalled(args, agents, scope) {
  let fileCount = 0;
  let dirCount = 0;

  for (const agent of agents) {
    const dests = resolveDestRoots(agent, scope, args.workspace);
    console.log(`[easyspec-init] ${agent} (${scope}) — root: ${dests.root}`);

    const targets = [];
    for (const dir of [dests.prompts, dests.agents, dests.rules]) {
      for (const name of listEsEntries(dir)) {
        targets.push({ target: path.join(dir, name), isDir: false });
      }
    }
    for (const name of listEsEntries(dests.skills, { dirs: true })) {
      targets.push({ target: path.join(dests.skills, name), isDir: true });
    }

    for (const { target, isDir } of targets) {
      const label = isDir ? "skill dir" : "file";
      if (args.dryRun) {
        console.log(`  would remove ${label}: ${target}`);
      } else {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`  removed ${label}: ${target}`);
      }
      if (isDir) {
        dirCount += 1;
      } else {
        fileCount += 1;
      }
    }
  }

  console.log(`[easyspec-init] ${args.dryRun ? "would remove" : "removed"} ${fileCount} file(s) and ${dirCount} skill dir(s).`);
}

async function resolveAgentSelection(args, { defaultAll = false } = {}) {
  let agents = args.agents;
  if (process.stdin.isTTY && !args.agentsExplicit) {
    agents = await promptForAgents();
  }
  if (!agents || agents.length === 0) {
    agents = defaultAll ? SUPPORTED_AGENTS.slice() : ["copilot"];
  }

  for (const agent of agents) {
    if (!SUPPORTED_AGENTS.includes(agent)) {
      throw new Error(`Unsupported --agent value '${agent}'. Currently supported: ${SUPPORTED_AGENTS.join(", ")}.`);
    }
  }

  return agents;
}

async function resolveScopeSelection(args, agents) {
  let scope = args.scope;
  if (process.stdin.isTTY && !args.scopeExplicit) {
    scope = await promptForScope(agents);
  }
  if (!["project", "global"].includes(scope)) {
    throw new Error(`Invalid --scope value '${scope}'. Use project or global.`);
  }
  return scope;
}

async function promptForAgents() {
  const selected = await multiselect({
    message: "Select target harness(es) — space to toggle, enter to confirm:",
    options: SUPPORTED_AGENTS.map((agent) => ({
      value: agent,
      label: TOOL_PROFILES[agent].label,
    })),
    required: true,
    initialValues: ["copilot"],
  });

  if (isCancel(selected)) {
    throw new Error("Harness selection cancelled.");
  }

  return selected;
}

async function promptForScope(agents) {
  const scope = await select({
    message: `Select install scope for ${agents.join(", ")}:`,
    options: [
      { value: "project", label: "project — install into the current project" },
      { value: "global", label: "global — install into your user profile" },
    ],
  });

  if (isCancel(scope)) {
    throw new Error("Scope selection cancelled.");
  }

  return scope;
}

function resolveModelSelection(args) {
  let preset = null;
  const presetName = args.modelPreset || null;
  if (presetName) {
    preset = MODEL_PRESETS[presetName];
    if (!preset) {
      throw new Error(`Invalid --model-preset value '${presetName}'. Use one of: ${Object.keys(MODEL_PRESETS).join(", ")}.`);
    }
  }

  return {
    technicalModel: args.techModel || preset?.technicalModel || "auto",
    nonTechnicalModel: args.nonTechModel || preset?.nonTechnicalModel || "auto",
    prompted: false,
    preset: presetName,
  };
}

export async function runCli(argv) {
  const args = parseArgs(argv);

  if (args.help || !args.command) {
    printHelp();
    return;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const templatesDir = path.resolve(path.dirname(currentFile), "..", "templates");

  if (args.command === "sync") {
    const report = syncTemplates(args, templatesDir, args.dryRun, args.force);
    console.log(`[easyspec-init] ${args.dryRun ? "would refresh" : "refreshed"} template profile: ${args.templateProfile}`);
    console.log(`[easyspec-init] source prompts: ${report.sourcePrompts}`);
    console.log(`[easyspec-init] source agents: ${report.sourceAgents}`);
    console.log(`[easyspec-init] prompts -> copied=${report.summary.prompts.copied} overwritten=${report.summary.prompts.overwritten} skipped=${report.summary.prompts.skipped}`);
    console.log(`[easyspec-init] agents  -> copied=${report.summary.agents.copied} overwritten=${report.summary.agents.overwritten} skipped=${report.summary.agents.skipped}`);
    if (report.summary.skills) {
      console.log(`[easyspec-init] skills  -> copied=${report.summary.skills.copied} overwritten=${report.summary.skills.overwritten} skipped=${report.summary.skills.skipped}`);
    }
    if (report.summary.agents.missing.length > 0) {
      console.warn(`[easyspec-init] missing agent files: ${report.summary.agents.missing.join(", ")}`);
    }
    return;
  }

  if (args.command === "list" || args.command === "uninstall") {
    if (args.command === "uninstall" && !args.agentsExplicit && !process.stdin.isTTY) {
      throw new Error("uninstall requires an explicit --agent value when not running interactively.");
    }
    const selected = await resolveAgentSelection(args, { defaultAll: args.command === "list" });
    const scope = await resolveScopeSelection(args, selected);
    if (args.command === "list") {
      listInstalled(args, selected, scope, templatesDir);
    } else {
      uninstallInstalled(args, selected, scope);
    }
    return;
  }

  if (args.command !== "init") {
    throw new Error(`Unknown command '${args.command}'. Supported: init, list, uninstall, sync.`);
  }

  const agents = await resolveAgentSelection(args);
  const scope = await resolveScopeSelection(args, agents);

  const contentRoot = resolveContentRoot(templatesDir);
  if (!fs.existsSync(contentRoot)) {
    throw new Error(`Content directory not found: ${contentRoot}`);
  }

  const options = {
    force: args.force,
    dryRun: args.dryRun,
    workspace: args.workspace,
  };
  const modelSelection = resolveModelSelection(args);

  const installReports = [];

  for (const agent of agents) {
    const sourceRoot = resolveSourceRoot(templatesDir, agent);
    if (!fs.existsSync(sourceRoot)) {
      throw new Error(`Template directory not found: ${sourceRoot}`);
    }

    const dests = resolveDestRoots(agent, scope, args.workspace);
    installReports.push(installToRoot(dests.root, dests.prompts, sourceRoot, contentRoot, agent, options, dests.skills));
  }

  console.log(`[easyspec-init] agent target(s): ${agents.join(", ")}`);
  console.log(`[easyspec-init] install scope: ${scope}`);
  const agentDirs = new Set();
  for (const report of installReports) {
    console.log(`[easyspec-init] ${args.dryRun ? "would update" : "updated"}: ${report.rootPath}`);
    if (report.promptsDest && report.promptsDest !== path.join(report.rootPath, TOOL_PROFILES[report.agent].promptDir)) {
      console.log(`  prompts -> ${report.promptsDest}`);
    }
    console.log(`  copied=${report.copied} overwritten=${report.overwritten} skipped=${report.skipped}`);
    if (args.dryRun && Array.isArray(report.files)) {
      for (const record of report.files) {
        console.log(`  [${record.action}] ${record.path}`);
      }
    }
    if (!TOOL_PROFILES[report.agent].skipAgents) {
      agentDirs.add(path.join(report.rootPath, "agents"));
    }
  }

  let modelUpdates = 0;
  for (const report of installReports) {
    if (report.agent !== "copilot") {
      continue; // model frontmatter only exists in Copilot agent files
    }
    const result = applyModelSelectionsToRoot(report.rootPath, modelSelection, args.dryRun);
    modelUpdates += result.updated;
  }

  console.log(`[easyspec-init] model selection: technical='${modelSelection.technicalModel}' non-technical='${modelSelection.nonTechnicalModel}'`);
  if (modelSelection.preset) {
    console.log(`[easyspec-init] model preset applied: ${modelSelection.preset}`);
  }
  console.log(`[easyspec-init] ${args.dryRun ? "would update" : "updated"} model settings in ${modelUpdates} agent file(s).`);

  const nonCopilotAgents = agents.filter((agent) => agent !== "copilot");
  if (nonCopilotAgents.length > 0 && (modelSelection.technicalModel !== "auto" || modelSelection.nonTechnicalModel !== "auto")) {
    console.warn(`[easyspec-init] note: model settings only apply to Copilot agent files (no effect on: ${nonCopilotAgents.join(", ")})`);
  }

  console.log("[easyspec-init] reminder: models default to auto — review installed *.md agent model values if you want per-agent overrides.");
  for (const agentDir of agentDirs) {
    console.log(`[easyspec-init] model settings location: ${agentDir}`);
  }
}
