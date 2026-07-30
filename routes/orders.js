const express = require('express');
const router = express.Router();

// Get Firestore from app
const getDb = (req) => req.app.get('db');

// =====================
// Routes - Orders
// =====================

/**
 * POST /api/orders
 */
router.post('/', async (req, res) => {
    try {
          const db = getDb(req);
          const orderData = req.body;

      // Ensure ID is set
      const orderId = orderData.id || 'ORD_' + Date.now();

      // Check if Mart Order
      const isMart = orderData.restaurantId === 'mart_001';
          if (isMart) {
                  orderData.statusAr = "جاهز للتسليم 📦";
                  orderData.status = "READY_FOR_PICKUP";
          }

      // Save to Firestore
      await db.collection('orders').doc(orderId).set({
              ...orderData,
              createdAt: new Date()
      });

      console.log(`✅ [Firestore] تم حفظ طلب جديد: ${orderId}`);

      // Emit Real-time update
      const io = req.app.get('socketio');
          if (io && isMart) {
                  io.emit('new_ready_order', {
                            orderId: orderId,
                            restaurantName: orderData.restaurant || 'زادنا مارت',
                            location: { lat: 32.2211, lng: 35.2622 }
                  });
          }

      res.status(201).json({ success: true, id: orderId });
    } catch (error) {
          console.error('❌ خطأ Firestore:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/orders
 */
router.get('/', async (req, res) => {
    try {
          const db = getDb(req);
          const { restaurantId } = req.query;

      let query = db.collection('orders').orderBy('createdAt', 'desc');

      if (restaurantId) {
              query = query.where('restaurantId', '==', restaurantId);
      }

      const snapshot = await query.get();
          const orders = [];
          snapshot.forEach(doc => orders.push(doc.data()));

      res.json(orders);
    } catch (error) {
          console.error('❌ خطأ GET Firestore:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PATCH /api/orders/:id
 */
router.patch('/:id', async (req, res) => {
    try {
          const db = getDb(req);
          const { id } = req.params;
          const { status, driver } = req.body;

      const updateData = {};
          if (status) {
                  updateData.status = status;
                  updateData.statusAr = status === 'ON_THE_WAY' ? 'في الطريق إليك 🛵' :
                                              status === 'DELIVERED' ? 'تم التسليم ✅' :
                                              status === 'PREPARING' ? 'قيد التحضير 👨‍🍳' : status;
          }
          if (driver) updateData.driver = driver;

      await db.collection('orders').doc(id).update(updateData);

      // Notify via sockets
      const io = req.app.get('socketio');
          if (io) {
                  io.emit('order_updated', {
                            orderId: id,
                            ...updateData,
                            timestamp: new Date()
                  });
          }

      res.json({ success: true });
    } catch (error) {
          console.error('❌ Error updating order:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
