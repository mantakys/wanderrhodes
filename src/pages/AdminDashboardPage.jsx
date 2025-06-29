import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ContentManagementSection from '@/components/admin/sections/ContentManagementSection';
import UserAnalyticsSection from '@/components/admin/sections/UserAnalyticsSection';
import PaymentTrackingSection from '@/components/admin/sections/PaymentTrackingSection';
import PerformanceMetricsSection from '@/components/admin/sections/PerformanceMetricsSection';
import SiteUpdatesSection from '@/components/admin/sections/SiteUpdatesSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { FileText, Users, DollarSign, BarChart3, Wand2 } from 'lucide-react';

const AdminDashboardPage = () => {
  const tabContent = [
    {
      value: "content",
      label: "Content",
      icon: <FileText className="w-5 h-5 mr-2" />,
      component: <ContentManagementSection />
    },
    {
      value: "analytics",
      label: "Analytics",
      icon: <Users className="w-5 h-5 mr-2" />,
      component: <UserAnalyticsSection />
    },
    {
      value: "payments",
      label: "Payments",
      icon: <DollarSign className="w-5 h-5 mr-2" />,
      component: <PaymentTrackingSection />
    },
    {
      value: "performance",
      label: "Performance",
      icon: <BarChart3 className="w-5 h-5 mr-2" />,
      component: <PerformanceMetricsSection />
    },
    {
      value: "updates",
      label: "Site Updates",
      icon: <Wand2 className="w-5 h-5 mr-2" />,
      component: <SiteUpdatesSection />
    }
  ];

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-primary">
          Wander Rhodes Dashboard
        </h1>
        
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-6">
            {tabContent.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabContent.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center">
                    {tab.icon}
                    <span className="ml-2">{tab.label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tab.component}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
