import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    table_name: 'BA-PORTAL-BASETABLE',
    id: 'B57153AB-B66E-4085-A4C1-929EC158FC3E',
    region: 'ap-southeast-2',
    use_transaction: false,
    attributes: {
      status: 'active',
      adviser_name: 'John Smith',
      investors: [
        {
          name: 'Bob',
          base_income: 120000,
          annual_growth_rate: 3,
          income_events: [
            {
              year: 5,
              type: 'increase',
              amount: 10000
            },
            {
              year: 10,
              type: 'set',
              amount: 150000
            }
          ]
        },
        {
          name: 'Alice',
          base_income: 100000,
          annual_growth_rate: 25,
          income_events: []
        }
      ],
      properties: [
        {
          name: 'Property A',
          purchase_year: 1,
          loan_amount: 600000,
          annual_principal_change: 0,
          rent: 30000,
          interest_rate: 5,
          other_expenses: 5000,
          property_value: 660000,
          initial_value: 600000,
          growth_rate: 3,
          investor_splits: [
            {
              name: 'Bob',
              percentage: 50
            },
            {
              name: 'Alice',
              percentage: 50
            }
          ]
        },
        {
          name: 'Property B',
          purchase_year: 3,
          loan_amount: 500000,
          annual_principal_change: 0,
          rent: 25000,
          interest_rate: 4,
          other_expenses: 4000,
          property_value: 550000,
          initial_value: 500000,
          growth_rate: 3,
          investor_splits: [
            {
              name: 'Bob',
              percentage: 50
            },
            {
              name: 'Alice',
              percentage: 50
            }
          ]
        }
      ]
    },
    loading: false,
    error: null,
    apiUrl: 'https://gwhfr6wpc8.execute-api.ap-southeast-2.amazonaws.com/prod'
  })

  // Fetch data from API Gateway using read_table endpoint
  const fetchPortfolioData = async () => {
    setFormData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // Construct the API Gateway URL for read-table endpoint
      const endpointUrl = `${formData.apiUrl}/read-table`
      
      // Create payload matching the API Gateway test payload structure
      const payload = {
        body: JSON.stringify({
          table_name: formData.table_name,
          id: formData.id,
          region: formData.region
        })
      }
      
      console.log('Fetching portfolio data from API Gateway:', endpointUrl)
      console.log('Request payload:', payload)
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }
      
      const responseData = await response.json()
      console.log('API Gateway response:', responseData)
      
      if (responseData.status === 'success' && responseData.result) {
        // Merge the fetched data with existing form data
        const fetchedResult = responseData.result
        
        setFormData(prev => ({
          ...prev,
          loading: false,
          attributes: {
            ...prev.attributes,
            // Merge investors data
            investors: fetchedResult.investors || prev.attributes.investors,
            // Merge properties data
            properties: fetchedResult.properties || prev.attributes.properties,
            // Update chart data if available
            ...(fetchedResult.chart1 && { chart1: fetchedResult.chart1 })
          }
        }))
        
        alert('Portfolio data loaded successfully from API Gateway!')
      } else {
        throw new Error(responseData.message || 'Failed to load portfolio data')
      }
      
    } catch (error) {
      console.error('Error fetching portfolio data:', error)
      setFormData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load portfolio data'
      }))
      alert(`Error loading portfolio data: ${error.message}`)
    }
  }

  // Load data on component mount
  useEffect(() => {
    // Commented out auto-load to avoid API calls on every render
    // fetchPortfolioData()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [name]: value
      }
    }))
  }

  const handleInvestorChange = (index, field, value) => {
    const updatedInvestors = [...formData.attributes.investors]
    updatedInvestors[index][field] = value
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        investors: updatedInvestors
      }
    }))
  }

  const handlePropertyChange = (index, field, value) => {
    const updatedProperties = [...formData.attributes.properties]
    updatedProperties[index][field] = value
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        properties: updatedProperties
      }
    }))
  }

  const handleInvestorSplitChange = (propertyIndex, splitIndex, field, value) => {
    const updatedProperties = [...formData.attributes.properties]
    updatedProperties[propertyIndex].investor_splits[splitIndex][field] = value
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        properties: updatedProperties
      }
    }))
  }

  const handleIncomeEventChange = (investorIndex, eventIndex, field, value) => {
    const updatedInvestors = [...formData.attributes.investors]
    updatedInvestors[investorIndex].income_events[eventIndex][field] = value
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        investors: updatedInvestors
      }
    }))
  }

  const addInvestor = () => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        investors: [...prev.attributes.investors, {
          name: '',
          base_income: 0,
          annual_growth_rate: 0,
          income_events: []
        }]
      }
    }))
  }

  const addProperty = () => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        properties: [...prev.attributes.properties, {
          name: '',
          purchase_year: 0,
          loan_amount: 0,
          annual_principal_change: 0,
          rent: 0,
          interest_rate: 0,
          other_expenses: 0,
          property_value: 0,
          initial_value: 0,
          growth_rate: 0,
          investor_splits: formData.attributes.investors.map(investor => ({
            name: investor.name,
            percentage: 100 / formData.attributes.investors.length
          }))
        }]
      }
    }))
  }

  const addIncomeEvent = (investorIndex) => {
    const updatedInvestors = [...formData.attributes.investors]
    updatedInvestors[investorIndex].income_events.push({
      year: 0,
      type: 'increase',
      amount: 0
    })
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        investors: updatedInvestors
      }
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
    alert('Form submitted successfully! Check console for details.')
  }

  return (
    <div className="investment-form-container">
      <h1>Investment Portfolio Management</h1>
      
      <div className="api-controls">
        <div className="form-group">
          <label htmlFor="api-url">API Gateway URL</label>
          <input
            type="text"
            id="api-url"
            value={formData.apiUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, apiUrl: e.target.value }))}
            className="form-control"
            placeholder="https://your-api-id.execute-api.region.amazonaws.com"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="table-name">Table Name</label>
          <input
            type="text"
            id="table-name"
            value={formData.table_name}
            onChange={(e) => setFormData(prev => ({ ...prev, table_name: e.target.value }))}
            className="form-control"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="record-id">Record ID</label>
          <input
            type="text"
            id="record-id"
            value={formData.id}
            onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
            className="form-control"
            required
          />
        </div>
        
        <button
          type="button"
          onClick={fetchPortfolioData}
          className="btn-primary"
          disabled={formData.loading}
        >
          {formData.loading ? 'Loading...' : 'Load Portfolio Data'}
        </button>
        
        {formData.error && (
          <div className="error-message">
            Error: {formData.error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="investment-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label htmlFor="adviser_name">Adviser Name</label>
            <input
              type="text"
              id="adviser_name"
              name="adviser_name"
              value={formData.attributes.adviser_name}
              onChange={handleInputChange}
              className="form-control"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={formData.attributes.status}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h2>Investors</h2>
          {formData.attributes.investors.map((investor, investorIndex) => (
            <div key={investorIndex} className="investor-card">
              <h3>Investor {investorIndex + 1}</h3>
              <div className="form-group">
                <label htmlFor={`investor-name-${investorIndex}`}>Name</label>
                <input
                  type="text"
                  id={`investor-name-${investorIndex}`}
                  value={investor.name}
                  onChange={(e) => handleInvestorChange(investorIndex, 'name', e.target.value)}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`investor-base-income-${investorIndex}`}>Base Income</label>
                <input
                  type="number"
                  id={`investor-base-income-${investorIndex}`}
                  value={investor.base_income}
                  onChange={(e) => handleInvestorChange(investorIndex, 'base_income', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  step="1000"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`investor-growth-rate-${investorIndex}`}>Annual Growth Rate (%)</label>
                <input
                  type="number"
                  id={`investor-growth-rate-${investorIndex}`}
                  value={investor.annual_growth_rate}
                  onChange={(e) => handleInvestorChange(investorIndex, 'annual_growth_rate', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>

              <div className="income-events-section">
                <h4>Income Events</h4>
                {investor.income_events.map((event, eventIndex) => (
                  <div key={eventIndex} className="income-event-card">
                    <div className="form-group">
                      <label htmlFor={`event-year-${investorIndex}-${eventIndex}`}>Year</label>
                      <input
                        type="number"
                        id={`event-year-${investorIndex}-${eventIndex}`}
                        value={event.year}
                        onChange={(e) => handleIncomeEventChange(investorIndex, eventIndex, 'year', parseInt(e.target.value))}
                        className="form-control"
                        min="0"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`event-type-${investorIndex}-${eventIndex}`}>Type</label>
                      <select
                        id={`event-type-${investorIndex}-${eventIndex}`}
                        value={event.type}
                        onChange={(e) => handleIncomeEventChange(investorIndex, eventIndex, 'type', e.target.value)}
                        className="form-control"
                      >
                        <option value="increase">Increase</option>
                        <option value="set">Set</option>
                        <option value="decrease">Decrease</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor={`event-amount-${investorIndex}-${eventIndex}`}>Amount</label>
                      <input
                        type="number"
                        id={`event-amount-${investorIndex}-${eventIndex}`}
                        value={event.amount}
                        onChange={(e) => handleIncomeEventChange(investorIndex, eventIndex, 'amount', parseFloat(e.target.value))}
                        className="form-control"
                        min="0"
                        step="1000"
                        required
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addIncomeEvent(investorIndex)}
                  className="btn-secondary"
                >
                  Add Income Event
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addInvestor} className="btn-secondary">
            Add Investor
          </button>
        </div>

        <div className="form-section">
          <h2>Properties</h2>
          {formData.attributes.properties.map((property, propertyIndex) => (
            <div key={propertyIndex} className="property-card">
              <h3>{property.name || `Property ${propertyIndex + 1}`}</h3>
              <div className="form-group">
                <label htmlFor={`property-name-${propertyIndex}`}>Property Name</label>
                <input
                  type="text"
                  id={`property-name-${propertyIndex}`}
                  value={property.name}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'name', e.target.value)}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-purchase-year-${propertyIndex}`}>Purchase Year</label>
                <input
                  type="number"
                  id={`property-purchase-year-${propertyIndex}`}
                  value={property.purchase_year}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'purchase_year', parseInt(e.target.value))}
                  className="form-control"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-loan-${propertyIndex}`}>Loan Amount</label>
                <input
                  type="number"
                  id={`property-loan-${propertyIndex}`}
                  value={property.loan_amount}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'loan_amount', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  step="1000"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-rent-${propertyIndex}`}>Annual Rent</label>
                <input
                  type="number"
                  id={`property-rent-${propertyIndex}`}
                  value={property.rent}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'rent', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  step="1000"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-interest-${propertyIndex}`}>Interest Rate (%)</label>
                <input
                  type="number"
                  id={`property-interest-${propertyIndex}`}
                  value={property.interest_rate}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'interest_rate', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-expenses-${propertyIndex}`}>Other Expenses</label>
                <input
                  type="number"
                  id={`property-expenses-${propertyIndex}`}
                  value={property.other_expenses}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'other_expenses', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  step="100"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-value-${propertyIndex}`}>Current Property Value</label>
                <input
                  type="number"
                  id={`property-value-${propertyIndex}`}
                  value={property.property_value}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'property_value', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  step="1000"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor={`property-growth-${propertyIndex}`}>Annual Growth Rate (%)</label>
                <input
                  type="number"
                  id={`property-growth-${propertyIndex}`}
                  value={property.growth_rate}
                  onChange={(e) => handlePropertyChange(propertyIndex, 'growth_rate', parseFloat(e.target.value))}
                  className="form-control"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>

              <div className="investor-splits-section">
                <h4>Investor Splits</h4>
                {property.investor_splits.map((split, splitIndex) => (
                  <div key={splitIndex} className="investor-split-card">
                    <div className="form-group">
                      <label htmlFor={`split-name-${propertyIndex}-${splitIndex}`}>Investor</label>
                      <select
                        id={`split-name-${propertyIndex}-${splitIndex}`}
                        value={split.name}
                        onChange={(e) => handleInvestorSplitChange(propertyIndex, splitIndex, 'name', e.target.value)}
                        className="form-control"
                        disabled
                      >
                        {formData.attributes.investors.map((investor, idx) => (
                          <option key={idx} value={investor.name}>{investor.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor={`split-percentage-${propertyIndex}-${splitIndex}`}>Percentage (%)</label>
                      <input
                        type="number"
                        id={`split-percentage-${propertyIndex}-${splitIndex}`}
                        value={split.percentage}
                        onChange={(e) => handleInvestorSplitChange(propertyIndex, splitIndex, 'percentage', parseFloat(e.target.value))}
                        className="form-control"
                        min="0"
                        max="100"
                        step="1"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={addProperty} className="btn-secondary">
            Add Property
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Submit Portfolio
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
