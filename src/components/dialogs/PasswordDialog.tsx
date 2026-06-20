import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Lock } from "lucide-react";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
  filename?: string;
}

export function PasswordDialog({
  open: isOpen,
  onOpenChange,
  onSubmit,
  filename,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    if (password) {
      onSubmit(password);
      setPassword("");
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password Required
          </DialogTitle>
          <DialogDescription>
            {filename
              ? <>&ldquo;<span className="inline-block max-w-[240px] truncate align-bottom">{filename}</span>&rdquo; is password protected. Enter the password to continue.</>
              : "This archive is password protected. Enter the password to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter password..."
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="active:scale-[0.98]">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!password} className="active:scale-[0.98]">
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
