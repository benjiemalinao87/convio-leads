import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { leadStatuses, leadSources, webhooks } from '@/data/leadsData';

export interface LeadsFilters {
  search: string;
  status: string;
  source: string;
  webhook: string;
  assignedTo: string;
}

interface LeadsFiltersProps {
  filters: LeadsFilters;
  onFiltersChange: (filters: LeadsFilters) => void;
  totalCount: number;
  filteredCount: number;
}

export function LeadsFiltersComponent({ 
  filters, 
  onFiltersChange, 
  totalCount, 
  filteredCount 
}: LeadsFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === 'all' ? '' : value });
  };

  const handleSourceChange = (value: string) => {
    onFiltersChange({ ...filters, source: value === 'all' ? '' : value });
  };

  const handleWebhookChange = (value: string) => {
    onFiltersChange({ ...filters, webhook: value === 'all' ? '' : value });
  };

  const handleAssignedToChange = (value: string) => {
    onFiltersChange({ ...filters, assignedTo: value === 'all' ? '' : value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      status: '',
      source: '',
      webhook: '',
      assignedTo: '',
    });
    setIsFilterOpen(false);
  };

  const hasActiveFilters = filters.status || filters.source || filters.webhook || filters.assignedTo;
  const activeFilterCount = [filters.status, filters.source, filters.webhook, filters.assignedTo].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Dropdown */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Filter Leads</h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-auto p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {leadStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${status.color}`} />
                          <span>{status.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Source</label>
                <Select value={filters.source || 'all'} onValueChange={handleSourceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {leadSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Webhook Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook</label>
                <Select value={filters.webhook || 'all'} onValueChange={handleWebhookChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All webhooks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All webhooks</SelectItem>
                    {webhooks.map((webhook) => (
                      <SelectItem key={webhook} value={webhook}>
                        {webhook}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned To</label>
                <Select value={filters.assignedTo || 'all'} onValueChange={handleAssignedToChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    <SelectItem value="John Admin">John Admin</SelectItem>
                    <SelectItem value="Sarah Manager">Sarah Manager</SelectItem>
                    <SelectItem value="Mike Sales">Mike Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {filteredCount} of {totalCount} leads
          {hasActiveFilters && (
            <span className="ml-2">
              ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied)
            </span>
          )}
        </div>
        
        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex items-center space-x-2">
            {filters.status && (
              <Badge variant="secondary" className="text-xs">
                Status: {leadStatuses.find(s => s.value === filters.status)?.label}
                <button
                  onClick={() => handleStatusChange('')}
                  className="ml-1 hover:text-foreground"
                  aria-label="Remove status filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.source && (
              <Badge variant="secondary" className="text-xs">
                Source: {filters.source}
                <button
                  onClick={() => handleSourceChange('')}
                  className="ml-1 hover:text-foreground"
                  aria-label="Remove source filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.webhook && (
              <Badge variant="secondary" className="text-xs">
                Webhook: {filters.webhook}
                <button
                  onClick={() => handleWebhookChange('')}
                  className="ml-1 hover:text-foreground"
                  aria-label="Remove webhook filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.assignedTo && (
              <Badge variant="secondary" className="text-xs">
                Assigned: {filters.assignedTo}
                <button
                  onClick={() => handleAssignedToChange('')}
                  className="ml-1 hover:text-foreground"
                  aria-label="Remove assignee filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
