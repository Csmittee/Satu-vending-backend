export async function createOmiseCharge(amount, description, env) {
    // Omise API call
    const response = await fetch('https://api.omise.co/charges', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(env.OMISE_SECRET_KEY + ':')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: amount,
            currency: 'thb',
            description: description,
            source: { type: 'promptpay' }
        })
    });
    
    if (!response.ok) {
        throw new Error('Omise charge creation failed');
    }
    
    return response.json();
}
