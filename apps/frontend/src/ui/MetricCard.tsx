import { motion } from 'framer-motion';

type MetricCardProps = {
  label: string;
  value: string | number;
  trend: string;
};

export const MetricCard = ({ label, value, trend }: MetricCardProps) => (
  <motion.div
    className="card"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <p className="subtle">{label}</p>
    <h3 className="metric">{value}</h3>
    <span className="badge">{trend}</span>
  </motion.div>
);
