# DMwithAI Demo Site

A demo website for testing **Cohort Retention Check** and **Audience Segmentation** modules.

## 🚀 Features

### Pages
- **Home** (`index.html`) - Landing page with overview and traffic source links
- **Products** (`products.html`) - Product catalog with 6 demo products
- **Product Detail** (`product-detail.html`) - Individual product pages with conversion buttons
- **About** (`about.html`) - Information about the demo site
- **Contact** (`contact.html`) - Contact form with conversion tracking

### Tracking Events
All pages automatically track:
- ✅ **pageview** - On every page load
- ✅ **engaged** - After 30 seconds or 75% scroll
- ✅ **bounce** - On quick exit without engagement
- ✅ **conversion** - On button clicks (newsletter, add to cart, purchase, form submit)

### Traffic Sources
Test different acquisition channels using UTM parameters:
- **Organic**: `?utm_source=google&utm_medium=organic&utm_campaign=seo`
- **Paid**: `?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale`
- **Social**: `?utm_source=facebook&utm_medium=social&utm_campaign=brand_awareness`
- **Direct**: No parameters

## 📊 Testing Scenarios

### Cohort Retention Check
1. **Generate Signups**: Visit the site from different traffic sources
2. **Track Retention**: Return to the site after 1, 7, 14, 30 days
3. **Channel Cohorts**: Use different UTM parameters to create channel-based cohorts
4. **Campaign Cohorts**: Use specific campaign IDs to create campaign-based cohorts

### Audience Segmentation
1. **Generate Sessions**: Navigate between pages to create multiple sessions
2. **Different Behaviors**: 
   - Quick bounces (exit immediately)
   - Engaged sessions (stay 30+ seconds or scroll 75%)
   - Conversions (click buttons)
3. **Returning Visitors**: Visit the site multiple times to test returning visitor detection
4. **Minimum Data**: Generate 100+ sessions to enable segmentation analysis

## 🎯 Quick Start

1. **Deploy to GitHub Pages**:
   ```bash
   git add .
   git commit -m "Add demo site features"
   git push origin main
   ```

2. **Enable GitHub Pages** in repository settings (Settings → Pages → Source: main branch)

3. **Test the Site**:
   - Visit the deployed site
   - Navigate between pages
   - Click conversion buttons
   - Use different UTM parameters
   - Return to the site later to test retention

## 📝 Event Generation Guide

### Pageviews
- Navigate to any page → Generates `pageview` event

### Engagement
- Stay on page for 30+ seconds → Generates `engaged` event
- Scroll 75% down the page → Generates `engaged` event

### Bounces
- Exit page quickly without engagement → Generates `bounce` event

### Conversions
- Click "Sign Up for Newsletter" on homepage → `conversion` with `goal: 'newsletter_signup'`
- Click "Add to Cart" on product detail → `conversion` with `goal: 'add_to_cart'` + value
- Click "Buy Now" on product detail → `conversion` with `goal: 'purchase'` + value
- Submit contact form → `conversion` with `goal: 'contact_form_submit'`

## 🔧 Configuration

The tracking snippet is configured in each HTML file:
```javascript
const COLLECTOR_BASE = "https://dmwithai.selftrainai.com/api/collector";
const TENANT_ID = "2";
const SITE_TOKEN = "icE56lQxxTWOwTR8dntpNkj-I-Vrxl0-";
```

Update these values if needed for your environment.

## 📈 Data Requirements

### Cohort Retention
- Minimum: 1 user per cohort
- Recommended: 10+ users per cohort for meaningful retention rates

### Audience Segmentation
- Minimum: 100 sessions
- Recommended: 500+ sessions for comprehensive segmentation

## 🎨 Customization

All styling is in `styles.css`. The site uses a simple, clean design that's easy to customize.

## 📚 Related Documentation

- [Cohort Retention Check Module](../dmwithai-backend/README.md)
- [Audience Segmentation Module](../dmwithai-backend/SEGMENTATION_DATA_COLLECTION.md)
