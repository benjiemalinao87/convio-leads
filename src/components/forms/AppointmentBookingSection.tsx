import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface AppointmentBookingSectionProps {
  value: {
    appointment_date?: string
    appointment_duration?: number
    appointment_type?: string
    appointment_notes?: string
  } | null
  onChange: (value: {
    appointment_date?: string
    appointment_duration?: number
    appointment_type?: string
    appointment_notes?: string
  } | null) => void
}

export function AppointmentBookingSection({ value, onChange }: AppointmentBookingSectionProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value?.appointment_date ? new Date(value.appointment_date) : undefined
  )
  const [selectedTime, setSelectedTime] = useState<string>(
    value?.appointment_date
      ? new Date(value.appointment_date).toTimeString().slice(0, 5) // HH:mm format
      : ''
  )

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    updateAppointmentDate(date, selectedTime)
  }

  const handleTimeChange = (time: string) => {
    setSelectedTime(time)
    updateAppointmentDate(selectedDate, time)
  }

  const updateAppointmentDate = (date: Date | undefined, time: string) => {
    if (date && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const appointmentDateTime = new Date(date)
      appointmentDateTime.setHours(hours, minutes, 0, 0)
      
      onChange({
        appointment_date: appointmentDateTime.toISOString(),
        appointment_duration: value?.appointment_duration || 60,
        appointment_type: value?.appointment_type || 'consultation',
        appointment_notes: value?.appointment_notes
      })
    } else {
      onChange(null)
    }
  }

  const handleDurationChange = (duration: number) => {
    onChange({
      appointment_date: value?.appointment_date,
      appointment_duration: duration,
      appointment_type: value?.appointment_type || 'consultation',
      appointment_notes: value?.appointment_notes
    })
  }

  const handleTypeChange = (type: string) => {
    onChange({
      appointment_date: value?.appointment_date,
      appointment_duration: value?.appointment_duration || 60,
      appointment_type: type,
      appointment_notes: value?.appointment_notes
    })
  }

  const handleNotesChange = (notes: string) => {
    onChange({
      appointment_date: value?.appointment_date,
      appointment_duration: value?.appointment_duration || 60,
      appointment_type: value?.appointment_type || 'consultation',
      appointment_notes: notes
    })
  }

  return (
    <div className="space-y-3">
      {/* Optional Notice - More compact */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Optional:</strong> You can skip this section and submit the form. We'll contact you to schedule a convenient time.
        </p>
      </div>

      {/* Date and Time Picker */}
      <div className="space-y-2">
        <Label className="text-base font-semibold text-gray-900">Appointment Date and Time</Label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="appointment-date" className="text-base font-medium text-gray-700">
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400 text-base h-11",
                    !selectedDate && "text-gray-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 bg-white border-gray-200 z-50" 
                align="start"
                side="top"
                sideOffset={5}
                avoidCollisions={true}
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const dateToCheck = new Date(date)
                    dateToCheck.setHours(0, 0, 0, 0)
                    // Disable today and past dates - only allow tomorrow onwards
                    return dateToCheck <= today
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="appointment-time" className="text-base font-medium text-gray-700">
              Time
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />
              <Input
                id="appointment-time"
                type="time"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="pl-12 pr-4 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 text-base h-11 cursor-pointer w-full"
                disabled={!selectedDate}
                onClick={(e) => {
                  // Open native time picker when clicking anywhere on the input
                  if (e.currentTarget && 'showPicker' in e.currentTarget && typeof (e.currentTarget as any).showPicker === 'function') {
                    (e.currentTarget as any).showPicker()
                  }
                }}
                onFocus={(e) => {
                  // Also open picker on focus
                  if (e.currentTarget && 'showPicker' in e.currentTarget && typeof (e.currentTarget as any).showPicker === 'function') {
                    (e.currentTarget as any).showPicker()
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Timezone Display */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
        </div>
      </div>

      {/* Duration and Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Duration */}
        <div className="space-y-1.5">
          <Label htmlFor="appointment-duration" className="text-base font-medium text-gray-700">
            Duration
          </Label>
          <Select
            value={String(value?.appointment_duration || 60)}
            onValueChange={(val) => handleDurationChange(Number(val))}
          >
            <SelectTrigger 
              id="appointment-duration"
              className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
            >
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="90">1.5 hours</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Appointment Type */}
        <div className="space-y-1.5">
          <Label htmlFor="appointment-type" className="text-base font-medium text-gray-700">
            Appointment Type
          </Label>
          <Select
            value={value?.appointment_type || 'consultation'}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger 
              id="appointment-type"
              className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="consultation">Consultation</SelectItem>
              <SelectItem value="estimate">Estimate</SelectItem>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="follow_up">Follow Up</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Additional Notes - More compact */}
      <div className="space-y-1.5">
        <Label htmlFor="appointment-notes" className="text-base font-medium text-gray-700">
          Additional Notes (Optional)
        </Label>
        <Textarea
          id="appointment-notes"
          value={value?.appointment_notes || ''}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Tell us about your goals, challenges, or any specific topics you'd like to discuss..."
          className="min-h-[80px] bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base"
        />
      </div>

      {/* Confirmation Display - More compact */}
      {value?.appointment_date && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800 font-medium">
            ✓ Appointment scheduled for: {format(new Date(value.appointment_date), "PPP 'at' p")}
          </p>
        </div>
      )}
    </div>
  )
}

