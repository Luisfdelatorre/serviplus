import React, { useState, useEffect } from 'react';
import './ReportPage.css';

function ReportPage() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReport(0);
  }, []);
  const fetchReport = async (day) => {
  fetch('http://localhost/report?date='+day)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    setReportData(data);
    setLoading(false);
  })
  .catch((err) => {
    setError(err.message);
    setLoading(false);
  });
  };
  const dayBefore =  () => {
    fetchReport(1);
  }

  if (loading) return <p>Loading report...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!reportData || !reportData.response) return <p>No report data available.</p>;

  return (
    <div className="report-container">
      <button onClick={dayBefore}>Día Anterior</button>
      <h1 className="report-title">Reporte de Pagos Diarios</h1>
      <h1 className="report-title">Ganancia Neta: ${reportData.profit.toFixed(3)}</h1>
      {Object.entries(reportData.response).map(([employeeID, employeeData]) => (
        <div key={employeeID} className="employee-section">
          <h2>{employeeData.name}</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Fecha</th>
                <th>Tipo de lavado</th>
                <th>Costo</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {employeeData.list.map((order) => (
                <tr key={order.OrderTransactionID}>
                  <td>{order.OrderID}</td>
                  <td>{order.OrderDateTime}</td>
                  <td>{order.MenuItemText}</td>
                  <td>${order.DefaultUnitPrice.toFixed(2)}</td>
                  <td>${order.ItemDelComp.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan="3"><strong>Total</strong></td>
                <td><strong>${employeeData.total.toFixed(2)}</strong></td>
                <td><strong>${employeeData.pay.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default ReportPage;
