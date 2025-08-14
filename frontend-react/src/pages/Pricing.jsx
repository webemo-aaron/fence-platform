import React, { useState, useEffect } from 'react'
import { pricingService } from '../services/api'
import { CheckIcon } from '@heroicons/react/24/outline'

const Pricing = () => {
  const [tiers, setTiers] = useState({})
  const [roiData, setRoiData] = useState(null)
  const [roiInputs, setRoiInputs] = useState({
    current_jobs_per_month: 25,
    average_job_value: 850,
    current_fuel_cost: 600,
    current_labor_hours: 180,
    hourly_rate: 28
  })
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const tiersData = await pricingService.getTiers()
        setTiers(tiersData)
        
        // Calculate initial ROI
        await calculateROI()
      } catch (error) {
        console.error('Failed to fetch pricing tiers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTiers()
  }, [])

  const calculateROI = async () => {
    setCalculating(true)
    try {
      const roi = await pricingService.calculateROI(roiInputs)
      setRoiData(roi)
    } catch (error) {
      console.error('Failed to calculate ROI:', error)
    } finally {
      setCalculating(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setRoiInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handleCalculateROI = (e) => {
    e.preventDefault()
    calculateROI()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pricing information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Smart Pricing & ROI Calculator
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Calculate your potential savings and choose the perfect plan for your fence business.
          </p>
        </div>

        {/* ROI Calculator */}
        <div className="mb-16">
          <div className="card max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">ROI Calculator</h2>
            
            <form onSubmit={handleCalculateROI} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Current Business Metrics</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jobs per Month
                  </label>
                  <input
                    type="number"
                    name="current_jobs_per_month"
                    value={roiInputs.current_jobs_per_month}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Average Job Value ($)
                  </label>
                  <input
                    type="number"
                    name="average_job_value"
                    value={roiInputs.average_job_value}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Fuel Cost ($)
                  </label>
                  <input
                    type="number"
                    name="current_fuel_cost"
                    value={roiInputs.current_fuel_cost}
                    onChange={handleInputChange}
                    className="input-field"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Labor Hours per Month
                  </label>
                  <input
                    type="number"
                    name="current_labor_hours"
                    value={roiInputs.current_labor_hours}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    name="hourly_rate"
                    value={roiInputs.hourly_rate}
                    onChange={handleInputChange}
                    className="input-field"
                    min="1"
                  />
                </div>

                <button
                  type="submit"
                  disabled={calculating}
                  className="btn-primary w-full"
                >
                  {calculating ? 'Calculating...' : 'Calculate ROI'}
                </button>
              </div>

              {/* ROI Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">ROI Results</h3>
                
                {roiData ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                      <h4 className="text-lg font-bold text-green-800 mb-4">Projected Savings</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-green-700">Monthly Fuel Savings:</span>
                          <span className="font-bold text-green-900">
                            ${roiData.financial_impact.monthly_fuel_savings}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Monthly Labor Savings:</span>
                          <span className="font-bold text-green-900">
                            ${roiData.financial_impact.monthly_labor_savings}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Additional Revenue:</span>
                          <span className="font-bold text-green-900">
                            ${roiData.financial_impact.monthly_additional_revenue}
                          </span>
                        </div>
                        <hr className="border-green-300" />
                        <div className="flex justify-between text-lg">
                          <span className="font-bold text-green-700">Total Monthly Benefit:</span>
                          <span className="font-bold text-green-900">
                            ${roiData.financial_impact.total_monthly_benefit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
                      <h4 className="text-lg font-bold text-primary-800 mb-4">ROI Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-primary-700">Annual ROI:</span>
                          <span className="font-bold text-primary-900">
                            {roiData.roi_metrics.annual_roi_percent.toLocaleString()}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-primary-700">Payback Period:</span>
                          <span className="font-bold text-primary-900">
                            {roiData.roi_metrics.payback_period_months} months
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-primary-700">Annual Benefit:</span>
                          <span className="font-bold text-primary-900">
                            ${roiData.financial_impact.total_annual_benefit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                      <h4 className="text-lg font-bold text-yellow-800 mb-2">Recommended Plan</h4>
                      <p className="text-yellow-700 capitalize font-semibold">
                        {roiData.recommendation.tier} - ${roiData.recommendation.monthly_cost}/month
                      </p>
                      <p className="text-sm text-yellow-600 mt-1">
                        Net annual benefit: ${roiData.recommendation.net_annual_benefit.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Enter your business metrics and click "Calculate ROI" to see your potential savings.
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Choose Your Plan
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {Object.entries(tiers).map(([tierKey, tier], index) => {
              const isPopular = tierKey === 'professional'
              const isRecommended = roiData?.recommendation?.tier === tierKey
              
              return (
                <div
                  key={tierKey}
                  className={`relative p-8 rounded-2xl border-2 transition-all ${
                    isPopular || isRecommended
                      ? 'border-primary-500 bg-primary-50 shadow-xl scale-105'
                      : 'border-gray-200 bg-white shadow-lg'
                  }`}
                >
                  {(isPopular || isRecommended) && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        {isRecommended ? 'Recommended' : 'Most Popular'}
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 capitalize">
                      {tier.name}
                    </h3>
                    <div className="text-4xl font-bold text-primary-600">
                      ${tier.price}
                      <span className="text-lg text-gray-600 font-normal">/month</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t pt-4 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-2">Limits:</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Jobs: {tier.limits.jobs === -1 ? 'Unlimited' : tier.limits.jobs}</div>
                      <div>Users: {tier.limits.users === -1 ? 'Unlimited' : tier.limits.users}</div>
                      <div>Storage: {tier.limits.storage}</div>
                    </div>
                  </div>

                  <button
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                      isPopular || isRecommended
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Choose {tier.name}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pricing