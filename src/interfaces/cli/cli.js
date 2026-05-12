import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";

export class CLI {
  constructor(container) {
    this.container = container;
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name("agents-cours")
      .description("CLI pour la gestion des cours via agents IA")
      .version("1.0.0");

    this.program
      .command("creer")
      .description("Créer un nouveau cours")
      .option("-t, --titre <titre>", "Titre du cours")
      .option("-T, --techno <techno>", "Technologie")
      .option("-n, --niveau <niveau>", "Niveau")
      .option("-d, --duree <duree>", "Durée")
      .option("-i, --interactif", "Mode interactif")
      .action((options) => this.commandeCreer(options));

    this.program
      .command("reviser")
      .description("Réviser un cours existant")
      .option("-c, --cours <id>", "ID du cours", Number.parseInt)
      .option("-t, --type <type>", "Type de révision")
      .option("-m, --message <commentaire>", "Commentaire")
      .option("-a, --appliquer", "Appliquer directement")
      .option("-i, --interactif", "Mode interactif")
      .action((options) => this.commandeReviser(options));

    this.program
      .command("lister")
      .description("Lister des cours")
      .option("-T, --techno <techno>", "Filtrer par technologie")
      .option("-n, --niveau <niveau>", "Filtrer par niveau")
      .option("-s, --statut <statut>", "Filtrer par statut")
      .option("--ia", "Lister les cours générés par IA")
      .option("--a-reviser", "Lister les cours à réviser")
      .action((options) => this.commandeLister(options));

    this.program
      .command("voir <id>")
      .description("Afficher un cours")
      .option("--html", "Afficher le HTML du cours")
      .action((id, options) =>
        this.commandeVoir(Number.parseInt(id, 10), options)
      );

    this.program
      .command("technologies")
      .description("Lister les technologies")
      .action(() => this.commandeTechnologies());

    this.program
      .command("niveaux")
      .description("Lister les niveaux")
      .action(() => this.commandeNiveaux());
  }

  async commandeCreer(options) {
    try {
      const demande =
        options.interactif ||
        !options.titre ||
        !options.techno ||
        !options.niveau ||
        !options.duree
          ? await this.promptCreation()
          : {
              titre: options.titre,
              technologie: options.techno,
              niveau: options.niveau,
              duree: options.duree,
              description: options.description
            };

      const spinner = ora("Génération du cours en cours").start();
      const creerCoursUseCase = this.container.getCreerCoursUseCase();
      const result = await creerCoursUseCase.executer(demande);
      spinner.succeed(chalk.green("Cours généré avec succès"));

      console.log(chalk.cyan("\nDétails du cours:"));
      console.log(`- Titre: ${result.cours.title}`);
      console.log(`- Technologie: ${result.cours.technology?.name}`);
      console.log(`- Niveau: ${result.cours.level?.name}`);
      console.log(`- Durée: ${result.cours.duration}`);
      console.log(`- Statut: ${result.cours.statut}`);
      console.log(`- ID: ${result.id}`);
      if (result.cours.objectifs) {
        console.log(chalk.cyan("\nObjectifs:"));
        console.log(result.cours.objectifs);
      }
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async promptCreation() {
    const listerCoursUseCase = this.container.getListerCoursUseCase();
    const technologies = await listerCoursUseCase.technologies();
    const niveaux = await listerCoursUseCase.niveaux();

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "titre",
        message: "Titre du cours:",
        validate: (value) => (value ? true : "Le titre est requis")
      },
      {
        type: "list",
        name: "technologie",
        message: "Technologie:",
        choices: technologies.map((tech) => tech.name)
      },
      {
        type: "list",
        name: "niveau",
        message: "Niveau:",
        choices: niveaux.map((niveau) => niveau.name)
      },
      {
        type: "input",
        name: "duree",
        message: "Durée (ex: 2h, 3h30):",
        validate: (value) => (value ? true : "La durée est requise")
      },
      {
        type: "input",
        name: "description",
        message: "Description (optionnelle):"
      }
    ]);

    return answers;
  }

  async commandeReviser(options) {
    try {
      const demande =
        options.interactif || !options.cours || !options.type || !options.message
          ? await this.promptRevision()
          : {
              coursId: options.cours,
              typeRevision: options.type,
              commentaire: options.message,
              appliquerDirectement: Boolean(options.appliquer)
            };

      const spinner = ora("Révision du cours en cours").start();
      const reviserCoursUseCase = this.container.getReviserCoursUseCase();
      const result = await reviserCoursUseCase.executer(demande);
      spinner.succeed(chalk.green("Révision générée avec succès"));

      console.log(chalk.cyan("\nDétails de la révision:"));
      console.log(`- ID: ${result.revisionId}`);
      console.log(`- Type: ${result.revision.typeRevision}`);
      console.log(`- Appliquée: ${result.revision.appliquee ? "oui" : "non"}`);
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async promptRevision() {
    const answers = await inquirer.prompt([
      {
        type: "number",
        name: "coursId",
        message: "ID du cours:",
        validate: (value) => (value ? true : "L'ID est requis")
      },
      {
        type: "list",
        name: "typeRevision",
        message: "Type de révision:",
        choices: [
          { name: "Correction", value: "correction" },
          { name: "Amélioration", value: "amelioration" },
          { name: "Retour élève", value: "retour_eleve" },
          { name: "Mise à jour techno", value: "maj_techno" }
        ]
      },
      {
        type: "input",
        name: "commentaire",
        message: "Commentaire:",
        validate: (value) => (value ? true : "Le commentaire est requis")
      },
      {
        type: "confirm",
        name: "appliquerDirectement",
        message: "Appliquer directement la révision ?",
        default: false
      }
    ]);

    return answers;
  }

  async commandeLister(options) {
    try {
      const listerCoursUseCase = this.container.getListerCoursUseCase();
      let cours = [];

      if (options.techno) {
        cours = await listerCoursUseCase.parTechnologie(options.techno);
      } else if (options.niveau) {
        cours = await listerCoursUseCase.parNiveau(options.niveau);
      } else if (options.statut) {
        cours = await listerCoursUseCase.parStatut(options.statut);
      } else if (options.ia) {
        cours = await listerCoursUseCase.coursIA();
      } else if (options.aReviser) {
        cours = await listerCoursUseCase.coursAReviser();
      } else {
        cours = await listerCoursUseCase.parStatut("publie");
      }

      if (!cours.length) {
        console.log(chalk.yellow("Aucun cours trouvé."));
        return;
      }

      console.log(chalk.cyan(`\n${cours.length} cours trouvés:`));
      cours.forEach((item) => {
        console.log(
          `- ${item.title} (${item.technology?.name} / ${item.level?.name}) [${item.statut}]`
        );
      });
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async commandeVoir(id, options) {
    try {
      const coursRepository = this.container.getCoursRepository();
      const cours = await coursRepository.trouverParId(id);
      if (!cours) {
        throw new Error("Cours non trouvé");
      }

      console.log(chalk.cyan("\nDétails du cours:"));
      console.log(`- ID: ${cours.id}`);
      console.log(`- Titre: ${cours.title}`);
      console.log(`- Technologie: ${cours.technology?.name}`);
      console.log(`- Niveau: ${cours.level?.name}`);
      console.log(`- Durée: ${cours.duration}`);
      console.log(`- Statut: ${cours.statut}`);
      console.log(`- Généré par IA: ${cours.genereParIA ? "oui" : "non"}`);

      if (options.html) {
        const html = cours.code || "";
        const contenu = html.length > 1000 ? `${html.slice(0, 1000)}...` : html;
        console.log(chalk.cyan("\nHTML du cours:"));
        console.log(contenu);
      }
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async commandeTechnologies() {
    try {
      const listerCoursUseCase = this.container.getListerCoursUseCase();
      const technologies = await listerCoursUseCase.technologies();

      console.log(chalk.cyan("\nTechnologies disponibles:"));
      technologies.forEach((tech) => {
        console.log(`- ${tech.name}`);
      });
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async commandeNiveaux() {
    try {
      const listerCoursUseCase = this.container.getListerCoursUseCase();
      const niveaux = await listerCoursUseCase.niveaux();

      console.log(chalk.cyan("\nNiveaux disponibles:"));
      niveaux.forEach((niveau) => {
        console.log(`- ${niveau.name}`);
      });
    } catch (error) {
      console.error(chalk.red(`Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  async run() {
    await this.program.parseAsync(process.argv);
  }
}
