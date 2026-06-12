type TimelineItem = {
  title: string;
  owner: string;
  time: string;
};

export const TimelinePanel = ({ timeline }: { timeline: TimelineItem[] }) => (
  <div className="card">
    <h3>Deployment Timeline</h3>
    <div className="timeline">
      {timeline.map((item) => (
        <div className="timeline-item" key={item.title}>
          <span className="timeline-dot" />
          <div>
            <strong>{item.title}</strong>
            <p className="subtle">{item.owner} · {item.time}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);
