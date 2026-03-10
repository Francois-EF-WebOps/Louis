#!/usr/bin/env node

/**
 * Louis Cost Calculator
 * Estimates processing costs for video files based on workflow configuration
 */

const fs = require('fs')

class LouisCostCalculator {
  constructor() {
    this.rates = {
      googleVideoIntelligence: 0.00075, // per minute
      cloudinaryTransform: 0, // free tier
      replicateUpscale: 0.027, // per minute at 720p
      lambdaInvoke: 0.0001, // flat per job
      r2Storage: 0.015 // per GB per hour
    }
  }

  /**
   * Calculate total cost for a video processing job
   */
  calculateCost(fileSizeGB, options = {}) {
    const {
      removeSilence = true,
      enableUpscale = false,
      activePercentage = 1, // Default: assume entire video is active
      withFreeTier = true
    } = options

    let cost = 0
    let breakdown = {}

    // Estimate duration (rough: 60 min per GB)
    const estimatedMinutes = fileSizeGB * 60

    // 1. Google Video Intelligence
    if (removeSilence) {
      const googleCost = estimatedMinutes * this.rates.googleVideoIntelligence
      const freeTierMinutes = 1000
      
      if (withFreeTier && estimatedMinutes <= freeTierMinutes) {
        breakdown.googleVideoIntelligence = {
          cost: 0,
          minutes: estimatedMinutes,
          note: 'Free tier (1000 min/month)'
        }
      } else {
        const chargeableMinutes = Math.max(0, estimatedMinutes - freeTierMinutes)
        breakdown.googleVideoIntelligence = {
          cost: chargeableMinutes * this.rates.googleVideoIntelligence,
          minutes: estimatedMinutes,
          note: `${chargeableMinutes} min charged`
        }
        cost += breakdown.googleVideoIntelligence.cost
      }
    }

    // 2. Cloudinary Transform
    breakdown.cloudinaryTransform = {
      cost: this.rates.cloudinaryTransform,
      note: 'Free tier (20k operations/month)'
    }

    // 3. Lambda Invocation
    breakdown.lambdaInvoke = {
      cost: this.rates.lambdaInvoke,
      note: 'Flat per job'
    }
    cost += this.rates.lambdaInvoke

    // 4. Replicate Upscale (if enabled)
    if (enableUpscale) {
      // Only active segments are upscaled
      const upscaleMinutes = estimatedMinutes * activePercentage
      const upscaleCost = upscaleMinutes * this.rates.replicateUpscale
      
      breakdown.replicateUpscale = {
        cost: upscaleCost,
        minutes: upscaleMinutes,
        note: `${upscaleMinutes.toFixed(1)} min at 720p`
      }
      cost += upscaleCost
    }

    // 5. R2 Storage
    // Assume: 24h storage of processed files (smaller than original)
    const storageEstimate = fileSizeGB * 0.5 * this.rates.r2Storage
    breakdown.r2Storage = {
      cost: storageEstimate,
      note: '24-hour retention'
    }
    cost += storageEstimate

    return {
      totalCost: parseFloat(cost.toFixed(2)),
      breakdown,
      estimatedMinutes: parseFloat(estimatedMinutes.toFixed(1))
    }
  }

  /**
   * Format result for display
   */
  formatResult(result) {
    const output = []
    output.push('\n' + '='.repeat(50))
    output.push('💰 Louis Cost Estimation Report')
    output.push('='.repeat(50))
    output.push('')
    output.push(`📊 Estimated Duration: ${result.estimatedMinutes} minutes`)
    output.push('')
    output.push('Cost Breakdown:')
    
    for (const [service, details] of Object.entries(result.breakdown)) {
      output.push(`  ${service}: $${details.cost.toFixed(2)}`)
      if (details.note) output.push(`    └─ ${details.note}`)
    }
    
    output.push('')
    output.push(`💵 TOTAL COST: $${result.totalCost.toFixed(2)}`)
    output.push('='.repeat(50) + '\n')
    
    return output.join('\n')
  }

  /**
   * Generate CSV report for multiple scenarios
   */
  generateReport(scenarios) {
    const csv = ['File Size (GB),Scenario,Active %,With Upscale,Total Cost ($)']
    
    for (const scenario of scenarios) {
      const result = this.calculateCost(
        scenario.fileSize,
        {
          removeSilence: scenario.removeSilence !== false,
          enableUpscale: scenario.enableUpscale === true,
          activePercentage: scenario.activePercentage || 1,
          withFreeTier: true
        }
      )
      
      csv.push(
        `${scenario.fileSize},${scenario.name},${(scenario.activePercentage || 1) * 100}%,${scenario.enableUpscale ? 'Yes' : 'No'},${result.totalCost}`
      )
    }
    
    return csv.join('\n')
  }
}

// Test scenarios
if (require.main === module) {
  const calc = new LouisCostCalculator()

  console.log('Testing Louis Cost Calculator\n')

  // Scenario 1: Small video (500MB), no upscale
  const small = calc.calculateCost(0.5, {
    removeSilence: true,
    enableUpscale: false,
    activePercentage: 0.6
  })
  console.log('Scenario 1: 500MB video (60% active), NO upscale')
  console.log(calc.formatResult(small))

  // Scenario 2: Large video (5GB), with upscale
  const large = calc.calculateCost(5, {
    removeSilence: true,
    enableUpscale: true,
    activePercentage: 0.4 // 40% active after silence removal
  })
  console.log('Scenario 2: 5GB video (40% active after silence removal), WITH upscale')
  console.log(calc.formatResult(large))

  // Generate multi-scenario report
  const scenarios = [
    { fileSize: 1, name: 'Small', activePercentage: 0.8, enableUpscale: false },
    { fileSize: 1, name: 'Small+Upscale', activePercentage: 0.8, enableUpscale: true },
    { fileSize: 5, name: 'Large', activePercentage: 0.4, enableUpscale: false },
    { fileSize: 5, name: 'Large+Upscale', activePercentage: 0.4, enableUpscale: true },
    { fileSize: 10, name: 'XLarge', activePercentage: 0.3, enableUpscale: false }
  ]

  console.log('📈 Multi-Scenario Cost Report:')
  const csv = calc.generateReport(scenarios)
  console.log(csv)

  // Save to CSV
  fs.writeFileSync('./cost-estimates.csv', csv)
  console.log('\n✅ CSV report saved to: cost-estimates.csv')
}

module.exports = LouisCostCalculator
