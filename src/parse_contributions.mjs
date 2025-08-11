import * as fs from 'fs';

export class ContributionParser {
  userContributions = new Map();

  trackLinkPatterns = [
    /https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/open\.spotify\.com\/intl-fr\/track\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/youtu\.be\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/soundcloud\.com\/[a-zA-Z0-9\/?=&%_-]+/g,
    /https:\/\/on\.soundcloud\.com\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/[a-zA-Z0-9-]+\.bandcamp\.com\/[a-zA-Z0-9\/?=&%_-]+/g,
    /https:\/\/music\.youtube\.com\/watch\?v=[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/ra\.co\/events\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/fr\.ra\.co\/events\/[a-zA-Z0-9?=&%_-]+/g,
    /https:\/\/www\.abconcerts\.be\/[a-zA-Z0-9\/?=&%_-]+/g,
  ];

  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          const parsedMessage = this.parseMessage(line);
          if (parsedMessage && parsedMessage.hasTrackLink) {
            this.addContribution(parsedMessage);
          }
        }
      }

      this.generateReport();
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  parseMessage(line) {
    const messagePattern = /^\[([^\]]+)\] ([^:]+): (.+)$/;
    const match = line.match(messagePattern);

    if (!match) {
      return null;
    }

    const [, timestamp, username, content] = match;
    const hasTrackLink = this.hasTrackLink(content);

    return {
      timestamp,
      username: username.trim(),
      content: content.trim(),
      hasTrackLink,
    };
  }

  hasTrackLink(content) {
    return this.trackLinkPatterns.some((pattern) => pattern.test(content));
  }

  addContribution(message) {
    const username = message.username;

    if (!this.userContributions.has(username)) {
      this.userContributions.set(username, {
        username,
        trackCount: 0,
        tracks: [],
      });
    }

    const userContribution = this.userContributions.get(username);

    const trackLinks = [];
    this.trackLinkPatterns.forEach((pattern) => {
      const matches = message.content.match(pattern);
      if (matches) {
        trackLinks.push(...matches);
      }
    });

    if (trackLinks.length > 0) {
      userContribution.trackCount += trackLinks.length;
      userContribution.tracks.push(...trackLinks);
    }
  }

  generateReport() {
    const sortedContributions = Array.from(
      this.userContributions.values(),
    ).sort((a, b) => b.trackCount - a.trackCount);

    const csvContent = this.generateCSV(sortedContributions);
    const detailedReport = this.generateDetailedReport(sortedContributions);

    fs.writeFileSync('user_contributions.csv', csvContent);
    fs.writeFileSync('detailed_contributions.txt', detailedReport);

    console.log('Reports generated successfully!');
    console.log('- user_contributions.csv: Summary of user contributions');
    console.log(
      '- detailed_contributions.txt: Detailed breakdown with track links',
    );

    this.displaySummary(sortedContributions);
  }

  generateCSV(contributions) {
    const headers = ['Username', 'Track Count'];
    const rows = contributions.map((c) => [
      c.username,
      c.trackCount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    return csvContent;
  }

  generateDetailedReport(contributions) {
    let report = 'DETAILED USER CONTRIBUTIONS REPORT\n';
    report += '=====================================\n\n';

    for (const contribution of contributions) {
      report += `USER: ${contribution.username}\n`;
      report += `Total Tracks: ${contribution.trackCount}\n`;
      report += 'Track Links:\n';

      contribution.tracks.forEach((track, index) => {
        report += `  ${index + 1}. ${track}\n`;
      });

      report += '\n' + '='.repeat(50) + '\n\n';
    }

    return report;
  }

  displaySummary(contributions) {
    console.log('\n=== SUMMARY ===');
    console.log(`Total users: ${contributions.length}`);
    console.log(
      `Total tracks shared: ${contributions.reduce((sum, c) => sum + c.trackCount, 0)}`,
    );

    console.log('\nTop contributors:');
    contributions.slice(0, 10).forEach((contribution, index) => {
      console.log(
        `${index + 1}. ${contribution.username}: ${contribution.trackCount} tracks`,
      );
    });
  }

  getContributions() {
    return Array.from(this.userContributions.values()).sort(
      (a, b) => b.trackCount - a.trackCount,
    );
  }
}
