import type { Meta, StoryObj } from '@storybook/react';
import { MetricCard } from '../ui/MetricCard';

const meta: Meta<typeof MetricCard> = {
  title: 'Dashboard/MetricCard',
  component: MetricCard,
  args: {
    label: 'Deployment Success',
    value: '98.4%',
    trend: '+1.2%',
  },
};

export default meta;

type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {};
