use anchor_lang::prelude::*;

declare_id!("C4ZACoQzWx1nyxKR9gtEs9zcwwSt5K1SQs8JjW3gJjks");

#[program]
pub mod signature_examples {
    use super::*;

    pub fn check_signer(ctx: Context<CheckSigner>) -> Result<()> {
        if ctx.accounts.signer.is_signer {
            msg!("Congratulations");
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CheckSigner<'info> {
    pub signer: Signer<'info>,    
}
