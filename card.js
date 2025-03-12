#!/usr/bin/env node

import boxen from 'boxen';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import openURL from 'open';
import { setTimeout as sleep } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const CONFIG = {
  PERSONAL_INFO: {
    NAME: 'Lucian Medrihan',
    TITLE: 'Full Stack Developer',
    EDUCATION: 'Sapienza Università di Roma, Computer and Automation Engineering',
    SKILLS: ['DevOps', 'Web Development', 'Cyber Security', 'Machine Learning'],
  },
  URLS: {
    EMAIL: 'mailto:medrihanlucian@gmail.com',
    PORTFOLIO: 'https://1vcian.github.io/Portfolio/',
    GITHUB: 'https://github.com/1vcian/',
    LINKEDIN: 'https://linkedin.com/in/lume',
  },
  THEME: {
    BORDER_COLOR: 'yellow',
    BG_COLOR: '#1a1a1a',
    ANIMATION_SPEED: {
      FAST: 10,
      MEDIUM: 30,
      SLOW: 50,
    },
  },
};

// Utility functions
const createAnimatedSpinner = async (text, duration = 500) => {
  const spinner = createSpinner(text).start();
  await sleep(duration);
  return spinner;
};

const animateText = async (text, speed = CONFIG.THEME.ANIMATION_SPEED.FAST) => {
  process.stdout.write('\n');
  for (const char of text) {
    process.stdout.write(char);
    await sleep(speed);
  }
  process.stdout.write('\n');
};

// Component for welcome banner
const WelcomeBanner = async () => {
  console.clear();
  console.log('\n');
  const spinner = await createAnimatedSpinner('Initializing...', 300);
  spinner.success();
  
  return new Promise((resolve) => {
    figlet(CONFIG.PERSONAL_INFO.NAME, {
      font: 'Big',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    }, async (err, data) => {
      if (!err) {
        const lines = data.split('\n');
        for (const line of lines) {
          console.log(gradient.rainbow(line));
          await sleep(CONFIG.THEME.ANIMATION_SPEED.MEDIUM);
        }
        await animateText(
          `{ ${CONFIG.PERSONAL_INFO.TITLE} }`,
          CONFIG.THEME.ANIMATION_SPEED.SLOW
        );
      }
      resolve();
    });
  });
};

// Component for profile card
const ProfileCard = async () => {
  const cardData = {
    name: gradient.pastel(CONFIG.PERSONAL_INFO.NAME),
    title: chalk.white(CONFIG.PERSONAL_INFO.TITLE),
    education: `${chalk.white('Graduated At')} ${gradient.morning(CONFIG.PERSONAL_INFO.EDUCATION)}`,
    github: `${chalk.white('{')} ${chalk.gray('github.com/')}${chalk.green('1vcian')} ${chalk.white('}')}`,
    linkedin: `${chalk.white('{')} ${chalk.gray('linkedin.com/in/')}${chalk.blue('lume')} ${chalk.white('}')}`,
    web: `${chalk.white('{')} ${chalk.cyan(CONFIG.URLS.PORTFOLIO)} ${chalk.white('}')}`,
    npx: `${chalk.red('npx')} ${chalk.white('1vcian')}`,
    skills: gradient.cristal(CONFIG.PERSONAL_INFO.SKILLS.join(' | ')),
  };

  const card = boxen(
    [
      cardData.name,
      cardData.title,
      '',
      `🎓 ${cardData.education}`,
      '',
      `⚡ Skills: ${cardData.skills}`,
      '',
      `📦 GitHub:    ${cardData.github}`,
      `💼 LinkedIn:  ${cardData.linkedin}`,
      `🌐 Website:   ${cardData.web}`,
      '',
      `📇 Card:      ${cardData.npx}`,
      '',
      gradient.passion('🚀 Available for exciting opportunities and collaborations!'),
      gradient.cristal('💭 Let\'s connect and create something amazing together!'),
    ].join('\n'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: CONFIG.THEME.BORDER_COLOR,
      float: 'center',
      backgroundColor: CONFIG.THEME.BG_COLOR,
      title: chalk.green.bold('Lucian\'s Business Card'),
      titleAlignment: 'center',
    }
  );

  for (const line of card.split('\n')) {
    console.log(line);
    await sleep(CONFIG.THEME.ANIMATION_SPEED.FAST);
  }
};

// Action handlers
const actionHandlers = {
  email: async () => {
    const spinner = await createAnimatedSpinner('Opening mail client...');
    await openURL(CONFIG.URLS.EMAIL);
    spinner.success({ text: gradient.passion('📧 Email client opened!') });
    await animateText(chalk.green('Looking forward to hearing from you!'));
  },


  viewPortfolio: async () => {
    const spinner = await createAnimatedSpinner('Loading portfolio...');
    await openURL(CONFIG.URLS.PORTFOLIO);
    spinner.success({ text: gradient.teen('🌐 Portfolio opened!') });
    await animateText(chalk.green('Hope you enjoy exploring my work!'));
  },

  viewGitHub: async () => {
    const spinner = await createAnimatedSpinner('Opening GitHub...');
    await openURL(CONFIG.URLS.GITHUB);
    spinner.success({ text: gradient.atlas('💻 GitHub profile opened!') });
    await animateText(chalk.green('Check out my latest projects!'));
  },
};

// Menu options
const menuOptions = [
  {
    type: 'list',
    name: 'action',
    message: gradient.cristal('What would you like to do?'),
    choices: [
      { name: `📧  ${gradient.passion('Send an Email')}`, value: 'email' },
      { name: `🌐  ${gradient.teen('Visit Portfolio')}`, value: 'viewPortfolio' },
      { name: `💻  ${gradient.atlas('View GitHub')}`, value: 'viewGitHub' },
      { name: gradient.rainbow('🚪  Exit'), value: 'quit' },
    ],
  },
];

// Main application
const main = async () => {
  try {
    await WelcomeBanner();
    await ProfileCard();
    
    console.log(
      gradient.passion('\n💡 Tip: Use ') + 
      chalk.cyan('cmd/ctrl + click') + 
      gradient.passion(' on links to open directly.\n')
    );

    while (true) {
      const { action } = await inquirer.prompt(menuOptions);
      
      if (action === 'quit') {
        await animateText(gradient.rainbow('\n👋 Thanks for stopping by! Have a great day!\n'));
        break;
      }
      
      await actionHandlers[action]();
    }
  } catch (error) {
    console.error(chalk.red('\n❌ An error occurred:'), error.message);
    process.exit(1);
  }
};

// Run the application
main().catch(console.error);