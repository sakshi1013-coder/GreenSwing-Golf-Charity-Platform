/**
 * Draw Engine - Core algorithm for monthly draws
 * Handles number generation, matching, prize distribution, and jackpot rollover
 */

class DrawEngine {
  constructor(options = {}) {
    this.minScore = options.minScore || 1;
    this.maxScore = options.maxScore || 45;
    this.drawSize = options.drawSize || 5;
    
    // Prize pool distribution
    this.prizeDistribution = {
      fiveMatch: 0.40,   // 40% → 5-match (rollover if no winner)
      fourMatch: 0.35,   // 35% → 4-match
      threeMatch: 0.25   // 25% → 3-match
    };
  }

  /**
   * Generate winning numbers for a draw
   * @returns {number[]} Array of unique random numbers sorted ascending
   */
  generateWinningNumbers() {
    const numbers = new Set();
    while (numbers.size < this.drawSize) {
      numbers.add(Math.floor(Math.random() * this.maxScore) + this.minScore);
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }

  /**
   * Match user's scores against winning numbers
   * @param {number[]} userScores - User's 5 scores
   * @param {number[]} winningNumbers - Draw's winning numbers
   * @returns {object} Match result with type and matched numbers
   */
  matchScores(userScores, winningNumbers) {
    const matched = userScores.filter(score => winningNumbers.includes(score));
    
    let matchType = null;
    if (matched.length >= 5) matchType = '5-match';
    else if (matched.length === 4) matchType = '4-match';
    else if (matched.length === 3) matchType = '3-match';

    return {
      matchCount: matched.length,
      matchType,
      matchedNumbers: matched,
      isWinner: matchType !== null
    };
  }

  /**
   * Calculate prize pool split
   * @param {number} totalPool - Total subscription revenue for prizes
   * @param {number} jackpotRollover - Accumulated rollover from previous months
   * @returns {object} Prize amounts per match type
   */
  calculatePrizePool(totalPool, jackpotRollover = 0) {
    return {
      fiveMatchPool: (totalPool * this.prizeDistribution.fiveMatch) + jackpotRollover,
      fourMatchPool: totalPool * this.prizeDistribution.fourMatch,
      threeMatchPool: totalPool * this.prizeDistribution.threeMatch,
      totalPool,
      jackpotRollover
    };
  }

  /**
   * Distribute prizes among winners
   * @param {object} prizePool - From calculatePrizePool
   * @param {object} winnerCounts - { fiveMatch: N, fourMatch: N, threeMatch: N }
   * @returns {object} Prize per winner by match type + new rollover amount
   */
  distributePrizes(prizePool, winnerCounts) {
    const result = {
      fiveMatchPrizePerWinner: 0,
      fourMatchPrizePerWinner: 0,
      threeMatchPrizePerWinner: 0,
      newJackpotRollover: 0
    };

    // 5-match: if no winners, rollover to next month
    if (winnerCounts.fiveMatch > 0) {
      result.fiveMatchPrizePerWinner = Math.floor(prizePool.fiveMatchPool / winnerCounts.fiveMatch * 100) / 100;
    } else {
      result.newJackpotRollover = prizePool.fiveMatchPool;
    }

    // 4-match: split evenly among winners
    if (winnerCounts.fourMatch > 0) {
      result.fourMatchPrizePerWinner = Math.floor(prizePool.fourMatchPool / winnerCounts.fourMatch * 100) / 100;
    }

    // 3-match: split evenly among winners
    if (winnerCounts.threeMatch > 0) {
      result.threeMatchPrizePerWinner = Math.floor(prizePool.threeMatchPool / winnerCounts.threeMatch * 100) / 100;
    }

    return result;
  }

  /**
   * Run a complete draw
   * @param {Array} allUserScores - Array of { userId, scores: number[] }
   * @param {number} totalPool - Total prize pool
   * @param {number} jackpotRollover - Previous jackpot rollover
   * @returns {object} Complete draw results
   */
  runDraw(allUserScores, totalPool, jackpotRollover = 0) {
    const winningNumbers = this.generateWinningNumbers();
    const prizePool = this.calculatePrizePool(totalPool, jackpotRollover);

    // Find all winners
    const winners = {
      fiveMatch: [],
      fourMatch: [],
      threeMatch: []
    };

    allUserScores.forEach(({ userId, scores }) => {
      const result = this.matchScores(scores, winningNumbers);
      
      if (result.matchType === '5-match') {
        winners.fiveMatch.push({ userId, ...result });
      } else if (result.matchType === '4-match') {
        winners.fourMatch.push({ userId, ...result });
      } else if (result.matchType === '3-match') {
        winners.threeMatch.push({ userId, ...result });
      }
    });

    const winnerCounts = {
      fiveMatch: winners.fiveMatch.length,
      fourMatch: winners.fourMatch.length,
      threeMatch: winners.threeMatch.length
    };

    const prizes = this.distributePrizes(prizePool, winnerCounts);

    return {
      winningNumbers,
      prizePool,
      winners,
      winnerCounts,
      prizes,
      totalWinners: winnerCounts.fiveMatch + winnerCounts.fourMatch + winnerCounts.threeMatch
    };
  }
}

module.exports = DrawEngine;
