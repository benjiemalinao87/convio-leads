import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AppointmentBookingSection } from '@/components/forms/AppointmentBookingSection'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface FormData {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  productid?: string
  source?: string
  notes?: string
  appointment?: {
    appointment_date?: string
    appointment_duration?: number
    appointment_type?: string
    appointment_notes?: string
  } | null
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'

export default function EmbeddableForm() {
  const [searchParams] = useSearchParams()
  const providerId = searchParams.get('provider_id') || ''

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<FormData>({
    defaultValues: {
      source: 'form-submission'
    }
  })

  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [appointmentData, setAppointmentData] = useState<FormData['appointment']>(null)

  const watchedProductId = watch('productid')

  useEffect(() => {
    if (!providerId) {
      setSubmissionState('error')
      setErrorMessage('Provider ID is required. Please contact support.')
    }
  }, [providerId])

  const onSubmit = async (data: FormData) => {
    if (!providerId) {
      setErrorMessage('Provider ID is required')
      setSubmissionState('error')
      return
    }

    setSubmissionState('submitting')
    setErrorMessage('')

    try {
      const payload = {
        provider_id: providerId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        productid: data.productid,
        source: data.source || 'form-submission',
        notes: data.notes,
        // Include appointment only if date is provided (making it optional)
        appointment: appointmentData?.appointment_date ? appointmentData : undefined
      }

      const response = await fetch('https://api.homeprojectpartners.com/forms/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to submit form')
      }

      setSubmissionState('success')

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Form submission error:', error)
      setSubmissionState('error')
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.')
    }
  }

  if (submissionState === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border border-gray-200 bg-white">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900">Thank You!</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Your form has been submitted successfully.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">
              {appointmentData?.appointment_date
                ? 'We have received your information and appointment booking. We will contact you soon to confirm your appointment.'
                : 'We have received your information and will contact you soon.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header - More Compact */}
        <div className="mb-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Request Your Appointment
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            Get expert guidance tailored to your needs—schedule your appointment at your convenience.
          </p>
        </div>

        {submissionState === 'error' && errorMessage && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Appointment Booking (Always Visible) */}
          <Card className="shadow-md border border-gray-200 bg-white">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900">Free Consultation</CardTitle>
                  <p className="text-sm text-gray-600">Optional appointment booking</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <AppointmentBookingSection
                value={appointmentData}
                onChange={setAppointmentData}
              />
            </CardContent>
          </Card>

          {/* Right Column - Contact Information */}
          <Card className="shadow-md border border-gray-200 bg-white">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl text-gray-900">My Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-base font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        id="firstName"
                        {...register('firstName', { required: 'First name is required' })}
                        placeholder="First name"
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                      />
                      {errors.firstName && (
                        <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        id="lastName"
                        {...register('lastName', { required: 'Last name is required' })}
                        placeholder="Last name"
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                      />
                      {errors.lastName && (
                        <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-base font-medium text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    placeholder="your.email@example.com"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-base font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register('phone', {
                      required: 'Phone number is required',
                      pattern: {
                        value: /^[\d\s\(\)\-\+]+$/,
                        message: 'Invalid phone number format'
                      }
                    })}
                    placeholder="(555) 123-4567"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-base font-medium text-gray-700">
                    Address
                  </Label>
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder="123 Main Street"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                  />
                </div>

                {/* City, State, ZIP */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-base font-medium text-gray-700">City</Label>
                    <Input
                      id="city"
                      {...register('city')}
                      placeholder="City"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-base font-medium text-gray-700">State</Label>
                    <Input
                      id="state"
                      {...register('state')}
                      placeholder="State"
                      maxLength={2}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="zipCode" className="text-base font-medium text-gray-700">Zip</Label>
                    <Input
                      id="zipCode"
                      {...register('zipCode')}
                      placeholder="ZIP"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                    />
                  </div>
                </div>

                {/* Service Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="productid" className="text-base font-medium text-gray-700">
                    Service Type
                  </Label>
                  <Select
                    onValueChange={(value) => setValue('productid', value)}
                    value={watchedProductId || ''}
                  >
                    <SelectTrigger 
                      id="productid"
                      className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 text-base h-11"
                    >
                      <SelectValue placeholder="Select a service type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="Kitchen">Kitchen</SelectItem>
                      <SelectItem value="Bath">Bath</SelectItem>
                      <SelectItem value="Solar">Solar</SelectItem>
                      <SelectItem value="Roofing">Roofing</SelectItem>
                      <SelectItem value="Basement Waterproofing">Basement Waterproofing</SelectItem>
                      <SelectItem value="HVAC">HVAC</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Notes - Made smaller */}
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-base font-medium text-gray-700">
                    Additional Notes
                  </Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Tell us about your goals, challenges, or any specific topics you'd like to discuss..."
                    className="min-h-[80px] bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-base"
                  />
                </div>

                {/* Consent Checkbox - More compact */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="consent"
                    name="consent"
                    aria-label="Consent to receive updates and agree to privacy policy"
                    className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    required
                  />
                  <Label htmlFor="consent" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                    Yes, I agree to receiving updates about my consultation. I understand that I can opt-out anytime. By clicking "Request Appointment", I agree to the <a href="#" className="text-blue-600 underline">privacy policy</a>.
                  </Label>
                </div>

                {/* Submit Button - More compact */}
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 text-lg shadow-md mt-2"
                  disabled={submissionState === 'submitting' || !providerId}
                >
                  {submissionState === 'submitting' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Request Appointment'
                  )}
                </Button>

                {!providerId && (
                  <p className="text-base text-red-600 text-center">
                    Provider ID is missing. Please contact support.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

