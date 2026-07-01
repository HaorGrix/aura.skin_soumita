import { useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "../../context/UserContext.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/index.js";
import PhoneInput, { BD_PHONE_REGEX } from "../../components/ui/PhoneInput.jsx";
import { User, Mail, MapPin } from "lucide-react";

export default function ProfileTab() {
  const { name, email, phone, address, updateProfile } = useUser();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name, email, phone: phone || "", address });
  const [isSaving, setIsSaving] = useState(false);
  const [isPhoneValid, setIsPhoneValid] = useState(
    phone ? BD_PHONE_REGEX.test(phone.replace(/\s+/g, "")) : false
  );

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const phoneRegex = BD_PHONE_REGEX;
    if (!phoneRegex.test(formData.phone?.replace(/\s+/g, ""))) {
      toast.error("Invalid number! Enter a valid BD phone number.");
      return;
    }
    if (!isPhoneValid) return;
    setIsSaving(true);
    // Simulate network delay
    setTimeout(() => {
      updateProfile(formData);
      setIsSaving(false);
      toast.success("Profile updated successfully ✨");
    }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-serif text-2xl text-ink dark:text-white">Personal Info</h2>
        <p className="mt-1 text-sm text-ink-soft dark:text-white/60">
          Update your details and how we can reach you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-semibold text-ink dark:text-white">
            Full Name
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft dark:text-white/40">
              <User className="h-4 w-4" />
            </span>
            <Input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="pl-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-ink dark:text-white">
            Email Address
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft dark:text-white/40">
              <Mail className="h-4 w-4" />
            </span>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="pl-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-ink dark:text-white">
            Phone Number
          </label>
          <PhoneInput
            value={formData.phone}
            onChange={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
            onValidityChange={setIsPhoneValid}
            placeholder="01XXXXXXXXX"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="address" className="text-sm font-semibold text-ink dark:text-white">
            Shipping Address
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-ink-soft dark:text-white/40">
              <MapPin className="h-4 w-4" />
            </span>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={formData.address}
              onChange={handleChange}
              className="w-full resize-none rounded-xl border border-line bg-snow py-3 pl-11 pr-4 text-sm text-ink outline-none transition-colors focus:border-magenta focus:ring-1 focus:ring-magenta dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-magenta"
            />
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={isSaving || !isPhoneValid} className="w-full sm:w-auto">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </motion.div>
  );
}
