import React from 'react';
import { incidents } from '../data/incidents';

export const IncidentDetails = ({ incidentId }: { incidentId: string }) => {
  const incident = incidents.find((inc) => inc.id === incidentId);

  if (!incident) {
    return <div>Incident not found</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">{incident.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold">Timeline</h3>
          <ul>
            {incident.timeline.map((event, index) => (
              <li key={index}>
                {event.time}: {event.description}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Root Cause Analysis</h3>
          <p>{incident.rca}</p>
        </div>
        <div>
          <h3 className="font-semibold">Affected Services</h3>
          <ul>
            {incident.affectedServices.map((service, index) => (
              <li key={index}>{service}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Resolution Notes</h3>
          <p>{incident.resolutionNotes}</p>
        </div>
        <div>
          <h3 className="font-semibold">Postmortem</h3>
          <p>{incident.postmortem}</p>
        </div>
        <div>
          <h3 className="font-semibold">AI Recommendations</h3>
          <ul>
            {incident.aiRecommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
